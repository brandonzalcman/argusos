import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { alertDeliveryRecordSchema } from "./alerts/alert-delivery-record.js";
import type { AlertDeliveryRow, RecipientOption } from "./alerts/alerts-source.js";
import {
  emptyDraft,
  filterRecipients,
  toggleItem,
  toRecipients,
  validateDraft,
} from "./alerts/compose.js";
import { pendingAcknowledgements } from "./alerts/use-alert-deliveries.js";
import { groupIncidents, isSwitchable } from "./incidents/incident-groups.js";
import { deriveLiveQueryState } from "./live-data/live-query-state.js";
import { QueryBoundary } from "./live-data/query-boundary.js";
import { formatTimestamp } from "./live-data/time.js";
import { initialCamera, visibleLayerIds } from "./maps/layers.js";
import { toMapSecurityScope } from "./maps/map-security-scope.js";
import { fixtureAlert, fixtureIncident, fixtureMapDefinition } from "./test-fixtures.js";

const retry = (): void => undefined;

describe("deriveLiveQueryState", () => {
  it("is unavailable without a scope and never claims data", () => {
    const state = deriveLiveQueryState({
      hasScope: false,
      isPending: true,
      error: null,
      data: undefined,
      retry,
    });
    expect(state.status).toBe("unavailable");
  });

  it("maps errors, loading, empty and ready", () => {
    const base = { hasScope: true, retry };
    expect(
      deriveLiveQueryState({
        ...base,
        isPending: false,
        error: new Error("boom"),
        data: undefined,
      }),
    ).toMatchObject({ status: "error", message: "boom" });
    expect(
      deriveLiveQueryState({ ...base, isPending: true, error: null, data: undefined }).status,
    ).toBe("loading");
    expect(deriveLiveQueryState({ ...base, isPending: false, error: null, data: [] }).status).toBe(
      "empty",
    );
    expect(deriveLiveQueryState({ ...base, isPending: false, error: null, data: [1] }).status).toBe(
      "ready",
    );
  });
});

describe("QueryBoundary", () => {
  const empty = { title: "Nothing here." };
  it("renders an error state with a retry button", () => {
    const html = renderToStaticMarkup(
      <QueryBoundary state={{ status: "error", message: "boom", retry }} label="x" empty={empty}>
        {() => "data"}
      </QueryBoundary>,
    );
    expect(html).toContain("Could not load x");
    expect(html).toContain("boom");
    expect(html).toContain("Try again");
  });

  it("renders a busy skeleton while loading and the unavailable explanation", () => {
    expect(
      renderToStaticMarkup(
        <QueryBoundary state={{ status: "loading" }} label="x" empty={empty}>
          {() => "data"}
        </QueryBoundary>,
      ),
    ).toContain('aria-busy="true"');
    expect(
      renderToStaticMarkup(
        <QueryBoundary
          state={{ status: "unavailable", reason: "no scope" }}
          label="x"
          empty={empty}
        >
          {() => "data"}
        </QueryBoundary>,
      ),
    ).toContain("no scope");
  });
});

describe("incidents", () => {
  it("separates exercises from live incidents and orders by status", () => {
    const groups = groupIncidents([
      fixtureIncident({ id: "a", name: "A", status: "closed" }),
      fixtureIncident({ id: "b", name: "B", status: "active" }),
      fixtureIncident({ id: "c", name: "C", kind: "exercise", status: "planned" }),
    ]);
    expect(groups.live.map((incident) => incident.id)).toEqual(["b", "a"]);
    expect(groups.exercises.map((incident) => incident.id)).toEqual(["c"]);
  });

  it("only allows switching to open incidents", () => {
    expect(isSwitchable(fixtureIncident({ status: "monitoring" }))).toBe(true);
    expect(isSwitchable(fixtureIncident({ status: "archived" }))).toBe(false);
  });
});

describe("alert compose", () => {
  it("requires title, message and a channel", () => {
    expect(Object.keys(validateDraft(emptyDraft)).sort()).toEqual([
      "channels",
      "message",
      "recipients",
      "title",
    ]);
    expect(
      validateDraft({
        ...emptyDraft,
        title: "t",
        message: "m",
        channels: ["email"],
        recipients: ["position:p1"],
      }),
    ).toEqual({});
  });

  it("toggles channels", () => {
    expect(toggleItem([], "sms")).toEqual(["sms"]);
    expect(toggleItem(["sms", "push"], "sms")).toEqual(["push"]);
  });

  it("maps picked recipients to schema recipients and drops unknown keys", () => {
    const options: RecipientOption[] = [
      { kind: "position", id: "p1", name: "Operations Chief", memberCount: 1 },
      { kind: "contact-group", id: "g1", name: "Shelter Managers", memberCount: null },
    ];
    expect(toRecipients(["contact-group:g1", "position:p1", "position:gone"], options)).toEqual([
      { type: "position", positionId: "p1" },
      { type: "contact-group", groupId: "g1" },
    ]);
    expect(filterRecipients(options, " shelter ")).toEqual([options[1]]);
  });

  it("lists each unacknowledged live alert once", () => {
    const row = (id: string, alertId: string, acknowledged: boolean): AlertDeliveryRow => ({
      id,
      title: alertId,
      channel: "email",
      status: "delivered",
      updatedAt: "2026-01-01T10:00:00.000Z",
      failureReason: null,
      alert: fixtureAlert({
        id: alertId,
        acknowledgedAt: acknowledged ? "2026-01-01T10:05:00.000Z" : null,
      }),
    });
    const pending = pendingAcknowledgements([
      row("1", "a", false),
      row("2", "a", false),
      row("3", "b", true),
    ]);
    expect(pending.map((entry) => entry.alert.id)).toEqual(["a"]);
  });
});

describe("maps", () => {
  it("applies viewer toggles over definition defaults", () => {
    const definition = fixtureMapDefinition([true, false]);
    expect(visibleLayerIds(definition, {})).toEqual(["fixture-layer-0"]);
    expect(
      visibleLayerIds(definition, { "fixture-layer-0": false, "fixture-layer-1": true }),
    ).toEqual(["fixture-layer-1"]);
  });

  it("derives the initial camera from the definition", () => {
    expect(initialCamera(fixtureMapDefinition([]))).toEqual({
      longitude: 10,
      latitude: 20,
      zoom: 5,
      bearing: 0,
      pitch: 0,
    });
  });
});

describe("formatTimestamp", () => {
  it("shows the zone and relative age", () => {
    const text = formatTimestamp(
      "2026-01-01T14:32:00.000Z",
      new Date("2026-01-01T14:35:00.000Z"),
      "UTC",
    );
    expect(text).toBe("14:32 UTC · 3 min ago");
  });
});

describe("delivery record proposal", () => {
  it("rejects unknown fields and invalid statuses", () => {
    const valid = {
      id: "d1",
      tenantId: "t1",
      incidentId: null,
      alertInstanceId: "a1",
      channel: "sms",
      status: "queued",
      attemptCount: 0,
      updatedAt: "2026-01-01T10:00:00.000Z",
      failureReason: null,
    };
    expect(alertDeliveryRecordSchema.safeParse(valid).success).toBe(true);
    expect(alertDeliveryRecordSchema.safeParse({ ...valid, status: "bounced" }).success).toBe(
      false,
    );
    expect(alertDeliveryRecordSchema.safeParse({ ...valid, recipient: "x" }).success).toBe(false);
  });
});

describe("map security scope", () => {
  const session = { userId: "u", positionId: "p", authenticatedAt: "2026-01-01T10:00:00.000Z" };
  it("is null without a scope or session so no map is created", () => {
    expect(toMapSecurityScope(null, session, "r")).toBeNull();
    expect(toMapSecurityScope({ tenantId: "t", incidentId: null }, null, "r")).toBeNull();
  });
  it("builds the operation context from scope and session", () => {
    expect(toMapSecurityScope({ tenantId: "t", incidentId: "i" }, session, "r")).toEqual({
      tenantId: "t",
      incidentId: "i",
      userId: "u",
      positionId: "p",
      requestId: "r",
      authenticatedAt: session.authenticatedAt,
    });
  });
});
