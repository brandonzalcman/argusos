import type {
  ComponentProp,
  CustomComponentDefinition,
  PluginCapability,
  SessionSnapshot,
  StudioDefinitionSummary,
} from "@argus/schema";
import { UIPreferencesProvider } from "@argus/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioServicesProvider } from "../../../services/studio.js";
import { ejectedComponentKey, isPlaceholderSource, mapConfigToPropValues } from "../eject.js";
import { sessionQueryKey } from "../session.js";
import {
  addCapability,
  availableCapabilityTypes,
  parseList,
  removeCapability,
  requiresAdminApproval,
  setCapabilityList,
  summarizeCapability,
  validateCapabilities,
} from "./capabilities-model.js";
import { ComponentEditor, componentQueryKey } from "./component-editor.js";
import { appendEntry, frameEventToEntry } from "./console-model.js";
import { compileProblems, errorRange, lineColumnToOffset } from "./diagnostics.js";
import {
  classifyStudioError,
  collectProblems,
  hasBlockingProblems,
  resolveEditorAccess,
} from "./editor-model.js";
import { EditorBlocked, EditorLoadFailure } from "./editor-states.js";
import {
  addOption,
  addProp,
  moveProp,
  removeProp,
  resolvePreviewValues,
  updateProp,
  validateProps,
} from "./props-model.js";

const ID = "c1000000-0000-4000-8000-000000000001";
const TABLE = "f1000002-0000-4000-8000-000000000001";
const FIELD = "f1000002-0000-4000-8000-000000000003";

/** FIXTURE DATA: used only by these tests. */
function prop(key: string, patch: Partial<ComponentProp> = {}): ComponentProp {
  return {
    key,
    label: key,
    description: null,
    type: "string",
    required: false,
    defaultValue: null,
    options: [],
    ...patch,
  };
}

function definition(patch: Partial<CustomComponentDefinition> = {}): CustomComponentDefinition {
  return {
    id: ID,
    tenantId: "a0000000-0000-4000-8000-000000000001",
    version: 1,
    lifecycle: "published",
    changeSummary: null,
    createdAt: "2026-11-19T00:00:00Z",
    createdBy: "b0000000-0000-4000-8000-000000000001",
    createdPositionId: "b0000000-0000-4000-8000-000000000002",
    publishedAt: null,
    publishedBy: null,
    key: "test_component",
    name: "Test component",
    description: null,
    language: "tsx",
    source: "export default function C() { return null; }",
    props: [],
    capabilities: [],
    ejectedFrom: null,
    sdkVersion: 1,
    ...patch,
  };
}

function summary(edit: boolean): StudioDefinitionSummary {
  return {
    id: ID,
    kind: "component",
    key: "test_component",
    name: "Test component",
    description: null,
    slug: null,
    publishedVersion: 1,
    draftVersion: null,
    hasUnpublishedChanges: false,
    updatedAt: "2026-11-19T00:00:00Z",
    updatedBy: "b0000000-0000-4000-8000-000000000001",
    publishedAt: null,
    permissions: { view: true, edit, publish: edit, editCode: edit },
  };
}

function snapshot(editCode: boolean): SessionSnapshot {
  return {
    studio: { viewStudio: true, editDefinitions: true, publishDefinitions: true, editCode },
  } as unknown as SessionSnapshot;
}

describe("props editor helpers", () => {
  it("adds props with unique keys and removes by index", () => {
    const one = addProp([]);
    const two = addProp(one);
    expect(two.map((p) => p.key)).toEqual(["prop_1", "prop_2"]);
    expect(removeProp(two, 0).map((p) => p.key)).toEqual(["prop_2"]);
  });

  it("reorders and clamps at the ends", () => {
    const props = [prop("a"), prop("b"), prop("c")];
    expect(moveProp(props, 2, -1).map((p) => p.key)).toEqual(["a", "c", "b"]);
    expect(moveProp(props, 0, -1).map((p) => p.key)).toEqual(["a", "b", "c"]);
    expect(moveProp(props, 1, 5).map((p) => p.key)).toEqual(["a", "c", "b"]);
  });

  it("clears options and default when the type changes away from enum", () => {
    const enumProp = prop("mode", {
      type: "enum",
      options: [{ value: "a", label: "A" }],
      defaultValue: "a",
    });
    const [next] = updateProp([enumProp], 0, { type: "string" });
    expect(next?.options).toEqual([]);
    expect(next?.defaultValue).toBeNull();
  });

  it("adds choices only to enum props", () => {
    expect(addOption([prop("a")], 0)[0]?.options).toEqual([]);
    expect(addOption([prop("a", { type: "enum" })], 0)[0]?.options).toHaveLength(1);
  });

  it("validates keys, duplicates, enum options and default types", () => {
    const issues = validateProps([
      prop("Bad Key"),
      prop("ok"),
      prop("ok"),
      prop("mode", { type: "enum" }),
      prop("n", { type: "number", defaultValue: "x" }),
      prop("s", { options: [{ value: "a", label: "A" }] }),
    ]);
    const fields = issues.map((i) => `${i.index}:${i.field}`);
    expect(fields).toContain("0:key");
    expect(fields).toContain("2:key");
    expect(fields).toContain("3:options");
    expect(fields).toContain("4:defaultValue");
    expect(fields).toContain("5:options");
    expect(validateProps([prop("fine")])).toEqual([]);
  });

  it("resolves preview values from overrides, then defaults", () => {
    const props = [
      prop("title", { defaultValue: "Default" }),
      prop("count", { type: "number" }),
      prop("flag", { type: "boolean", defaultValue: true }),
    ];
    expect(resolvePreviewValues(props, { title: "Mine", count: 3 })).toEqual({
      title: "Mine",
      count: 3,
      flag: true,
    });
    expect(resolvePreviewValues(props, {})).toEqual({ title: "Default", flag: true });
  });
});

describe("compile diagnostics", () => {
  it("maps 1-based line and column to offsets, clamped to the line", () => {
    const text = "ab\ncde\nf";
    expect(lineColumnToOffset(text, 1, 1)).toBe(0);
    expect(lineColumnToOffset(text, 2, 2)).toBe(4);
    expect(lineColumnToOffset(text, 2, 99)).toBe(6);
    expect(lineColumnToOffset(text, 9, 1)).toBe(text.length);
    expect(lineColumnToOffset(text, null, null)).toBe(0);
  });

  it("underlines the word at the error position", () => {
    expect(errorRange("let value = 1", 1, 5)).toEqual({ from: 4, to: 9 });
  });

  it("reports a located syntax error with offsets inside the source", () => {
    const source = "export default function C() {\n  return <div>;\n}\n";
    const [problem] = compileProblems(source);
    expect(problem).toBeDefined();
    expect(problem?.line).not.toBeNull();
    expect(problem?.from).toBeGreaterThanOrEqual(0);
    expect(problem?.to).toBeLessThanOrEqual(source.length);
  });

  it("rejects imports outside the allowlist and accepts valid source", () => {
    expect(compileProblems('import fs from "fs";\nexport default () => null;')).toHaveLength(1);
    expect(compileProblems("export default function C() { return null; }")).toEqual([]);
  });

  it("combines problem sources and flags blocking errors", () => {
    const draft = definition({ props: [prop("Bad Key")] });
    const problems = collectProblems(draft, compileProblems("export default {"));
    expect(problems.some((p) => p.area === "source")).toBe(true);
    expect(problems.some((p) => p.area === "props")).toBe(true);
    expect(hasBlockingProblems(problems)).toBe(true);
    expect(hasBlockingProblems(collectProblems(definition(), []))).toBe(false);
  });
});

describe("capability helpers", () => {
  it("adds one entry per type, removes, and offers only unused types", () => {
    const caps = addCapability(addCapability([], "read-records"), "read-records");
    expect(caps).toHaveLength(1);
    expect(availableCapabilityTypes(caps)).not.toContain("read-records");
    expect(removeCapability(caps, 0)).toEqual([]);
  });

  it("parses text lists and sets only keys the capability owns", () => {
    expect(parseList("a, b\nb;c  ")).toEqual(["a", "b", "c"]);
    const caps = addCapability([], "read-records");
    const withTables = setCapabilityList(caps, 0, "tableIds", [TABLE]);
    expect(withTables[0]).toMatchObject({ tableIds: [TABLE] });
    expect(setCapabilityList(caps, 0, "allowedHosts", ["x.org"])).toEqual(caps);
  });

  it("marks outbound-http and workflow-action as needing approval", () => {
    expect(requiresAdminApproval({ type: "outbound-http", allowedHosts: [] })).toBe(true);
    expect(requiresAdminApproval({ type: "workflow-action", actionKeys: [] })).toBe(true);
    expect(requiresAdminApproval({ type: "read-records", tableIds: [], fieldIds: [] })).toBe(false);
  });

  it("validates ids and hosts and warns about empty lists", () => {
    const caps: PluginCapability[] = [
      { type: "read-records", tableIds: ["nope"], fieldIds: [FIELD] },
      { type: "outbound-http", allowedHosts: ["https://x.org/path"] },
      { type: "update-records", tableIds: [], fieldIds: [] },
    ];
    const issues = validateCapabilities(caps);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(2);
    expect(issues.some((i) => i.index === 2 && i.severity === "warning")).toBe(true);
    expect(summarizeCapability({ type: "read-records", tableIds: [TABLE], fieldIds: [] })).toBe(
      "Read records: 1 table, 0 fields",
    );
  });
});

describe("eject mapping", () => {
  it("maps matching, type-compatible config entries to prop values only", () => {
    const props = [
      prop("tableId", { type: "table" }),
      prop("label"),
      prop("limit", { type: "number" }),
      prop("field_id", { type: "field" }),
    ];
    const values = mapConfigToPropValues(
      { tableId: TABLE, label: "Open", limit: "many", fieldId: FIELD, extra: 1, nested: { a: 1 } },
      props,
    );
    expect(values).toEqual({ tableId: TABLE, label: "Open", field_id: FIELD });
  });

  it("returns nothing when no keys match", () => {
    expect(mapConfigToPropValues({ foo: "bar" }, [prop("label")])).toEqual({});
  });

  it("builds schema-valid component keys and detects placeholder sources", () => {
    expect(ejectedComponentKey("field-input", "ab12-CD")).toMatch(/^[a-z][a-z0-9_]{0,62}$/);
    expect(isPlaceholderSource("// TODO(implementation): this is a placeholder for x")).toBe(true);
    expect(isPlaceholderSource("export default () => null")).toBe(false);
  });
});

describe("editor access and errors", () => {
  it("resolves signed-out, no access and read-only states", () => {
    expect(resolveEditorAccess(null, null).state).toBe("signed-out");
    const noStudio = {
      studio: {
        viewStudio: false,
        editDefinitions: false,
        publishDefinitions: false,
        editCode: false,
      },
    } as unknown as SessionSnapshot;
    expect(resolveEditorAccess(noStudio, null).state).toBe("no-access");
    const readOnly = resolveEditorAccess(snapshot(false), null);
    expect(readOnly).toMatchObject({ state: "ready", canEdit: false, canPublish: false });
    const editable = resolveEditorAccess(snapshot(true), summary(true).permissions);
    expect(editable).toMatchObject({ canEdit: true, canPublish: true, readOnlyReason: null });
  });

  it("classifies studio errors by message prefix", () => {
    expect(classifyStudioError(new Error("TODO(implementation): StudioPort.get"))).toBe(
      "not-connected",
    );
    expect(classifyStudioError(new Error("not-found: x"))).toBe("not-found");
    expect(classifyStudioError(new Error("boom"))).toBe("error");
  });

  it("maps frame events to console entries and caps the log", () => {
    expect(frameEventToEntry({ type: "resize", height: 10 }, 1)).toBeNull();
    expect(
      frameEventToEntry({ type: "error", phase: "compile", message: "x", line: 2, column: 3 }, 1),
    ).toMatchObject({ level: "error", line: 2, column: 3 });
    let entries = appendEntry(
      [],
      { id: 0, level: "log", origin: "console", text: "a", line: null, column: null },
      2,
    );
    for (let i = 1; i < 4; i++) {
      entries = appendEntry(
        entries,
        { id: i, level: "log", origin: "console", text: "b", line: null, column: null },
        2,
      );
    }
    expect(entries.map((e) => e.id)).toEqual([2, 3]);
  });
});

function renderEditor(editCode: boolean, seedDefinition = true): string {
  const client = new QueryClient();
  client.setQueryData(sessionQueryKey, snapshot(editCode));
  if (seedDefinition) {
    client.setQueryData(componentQueryKey(ID), {
      summary: summary(editCode),
      version: 1,
      definition: definition(),
      revision: "published",
    });
  }
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <StudioServicesProvider>
        <UIPreferencesProvider persist={false}>
          <ComponentEditor componentId={ID} />
        </UIPreferencesProvider>
      </StudioServicesProvider>
    </QueryClientProvider>,
  );
}

describe("ComponentEditor (server render)", () => {
  it("shows a read-only notice and one h1 when the position can't edit code", () => {
    const html = renderEditor(false);
    expect(html).toContain("can&#x27;t edit code");
    expect(html).toContain("Read-only");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Test component");
    expect(html).toContain("Preview of Test component");
  });

  it("offers editing without the notice when the position can edit code", () => {
    const html = renderEditor(true);
    expect(html).not.toContain("can&#x27;t edit code");
    expect(html).toContain("Save draft");
    expect(html).toContain("Publish");
  });

  it("renders the loading skeleton while the component loads", () => {
    const html = renderEditor(true, false);
    expect(html).toContain("Loading component");
  });

  it("renders the not-connected and blocked states", () => {
    const notConnected = renderToStaticMarkup(
      <EditorLoadFailure
        failure="not-connected"
        message=""
        onRetry={() => undefined}
        retrying={false}
      />,
    );
    expect(notConnected).toContain("Studio isn&#x27;t connected yet");
    expect(renderToStaticMarkup(<EditorBlocked reason="signed-out" />)).toContain("Sign in");
    expect(renderToStaticMarkup(<EditorBlocked reason="no-access" />)).toContain("view studio");
  });
});
