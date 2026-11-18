import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusPill, statusDefinitions, statusLevels } from "./badge.js";
import { Button } from "./button.js";
import { ConnectionIndicator } from "./connection-indicator.js";
import { Field, Input } from "./field.js";
import { IconButton } from "./icon-button.js";
import { NewRowsIndicator } from "./new-rows-indicator.js";
import { initialsFor, PresenceAvatars } from "./presence-avatars.js";
import { ScaffoldPage } from "./scaffold-page.js";
import { ErrorState } from "./states.js";
import { TooltipProvider } from "./tooltip.js";
import { TopBar } from "./top-bar.js";

const render = (node: ReactNode): string =>
  renderToStaticMarkup(<TooltipProvider>{node}</TooltipProvider>);
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("status is never conveyed by colour alone", () => {
  it.each(statusLevels)("%s renders an icon and a visible text label", (level) => {
    const html = render(<StatusPill status={level} />);
    expect(html).toContain("<svg");
    expect(text(html)).toContain(statusDefinitions[level].label);
  });

  it("uses tenant terminology when provided", () => {
    expect(text(render(<StatusPill status="high" label="Level 2" />))).toBe("Level 2");
  });

  it("each status level has a distinct icon", () => {
    const icons = new Set(statusLevels.map((level) => statusDefinitions[level].icon));
    // low and info share the info tone but must still differ in shape.
    expect(icons.size).toBe(statusLevels.length);
  });
});

describe("TopBar context", () => {
  it('shows "Not selected" for every missing context value', () => {
    const html = render(
      <TopBar
        activeIncidentLabel={null}
        incidentLevel={null}
        operationalPeriodLabel=""
        positionLabel={null}
        connection={null}
      />,
    );
    expect(html.match(/>Not selected</g)).toHaveLength(4);
    expect(html).toContain('aria-label="Current operations context"');
  });

  it("shows provided labels instead of the placeholder", () => {
    const html = render(
      <TopBar
        activeIncidentLabel="Sample incident"
        incidentLevel={{ label: "Level 2", status: "high" }}
        operationalPeriodLabel="Period 1"
        positionLabel="Sample position"
        connection={null}
      />,
    );
    expect(html).not.toContain("Not selected");
    expect(text(html)).toContain("Sample incident");
    expect(text(html)).toContain("Level 2");
  });
});

describe("accessible names and states", () => {
  it("IconButton always has an accessible name", () => {
    expect(render(<IconButton label="Refresh data" icon={<span />} />)).toContain(
      'aria-label="Refresh data"',
    );
  });

  it("loading Button is busy and labelled", () => {
    const html = render(<Button loading>Saving</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(text(html)).toBe("Saving");
  });

  it("Field wires label, description and error to the control", () => {
    const html = render(
      <Field
        id="callsign"
        label="Callsign"
        description="As used on radio"
        error="Required"
        required
      >
        <Input />
      </Field>,
    );
    expect(html).toContain('for="callsign"');
    expect(html).toMatch(/<input[^>]*id="callsign"/);
    expect(html).toMatch(/aria-describedby="callsign-description callsign-error"/);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<input[^>]*required/);
  });

  it("ErrorState offers retry and shows the reference", () => {
    const html = render(
      <ErrorState title="Couldn't load" onRetry={() => undefined} reference="abc-123" />,
    );
    expect(text(html)).toContain("Try again");
    expect(text(html)).toContain("abc-123");
  });
});

describe("live data honesty", () => {
  it("ConnectionIndicator never invents a last-update time", () => {
    const html = render(<ConnectionIndicator state="offline" />);
    expect(text(html)).toContain("Last update unavailable");
    expect(html).not.toContain("<time");
  });

  it("NewRowsIndicator renders no pill for zero or invalid counts", () => {
    expect(text(render(<NewRowsIndicator count={0} />))).toBe("");
    expect(text(render(<NewRowsIndicator count={-2} />))).toBe("");
    expect(text(render(<NewRowsIndicator count={3} noun="events" />))).toContain("3 new events");
  });

  it("ScaffoldPage labels itself as containing no operational data", () => {
    const html = render(
      <ScaffoldPage title="Maps" description="d" implementationOrder={["Step one"]} />,
    );
    expect(text(html)).toContain("Scaffold only — no operational data is loaded");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("PresenceAvatars reports nobody rather than rendering placeholders", () => {
    expect(text(render(<PresenceAvatars people={[]} />))).toBe("No one else viewing");
    const html = render(
      <PresenceAvatars
        maxVisible={1}
        people={[
          { id: "1", displayName: "Sample Person" },
          { id: "2", displayName: "Other" },
        ]}
      />,
    );
    expect(text(html)).toContain("and 1 more");
    expect(initialsFor("  sample   person ")).toBe("SP");
    expect(initialsFor("")).toBe("?");
  });
});
