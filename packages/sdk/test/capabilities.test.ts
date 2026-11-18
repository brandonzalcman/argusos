import { describe, expect, it } from "vitest";
import {
  CapabilityDeniedError,
  type CapabilityGrant,
  grantedFieldIds,
  grantsFromComponentCapabilities,
  type PluginSecurityScope,
  redactValues,
  requirePluginCapability,
  requirePluginFields,
} from "../src/protocol/capabilities.js";

function scope(grants: CapabilityGrant[], expiresAt: Date | null = null): PluginSecurityScope {
  return {
    tenantId: "t1",
    installationId: "sandbox",
    actorUserId: null,
    actorPositionId: null,
    grants,
    authorizationRevision: 1,
    expiresAt,
  };
}
const read = (
  tableIds: string[] | null,
  fieldIds: string[] | null,
  incidentIds: string[] | null = null,
): CapabilityGrant => ({
  capability: "record:read",
  tableIds,
  fieldIds,
  incidentIds,
  destinations: null,
});

describe("requirePluginCapability", () => {
  const s = scope([read(["t-a"], ["f-1", "f-2"])]);

  it("allows granted table and field", () => {
    expect(
      requirePluginCapability(s, "record:read", { tableId: "t-a", fieldId: "f-1" }).capability,
    ).toBe("record:read");
  });

  it("denies ungranted tables and fields with a redacted error", () => {
    expect(() => requirePluginCapability(s, "record:read", { tableId: "t-b" })).toThrow(
      CapabilityDeniedError,
    );
    expect(() =>
      requirePluginCapability(s, "record:read", { tableId: "t-a", fieldId: "f-9" }),
    ).toThrow("Capability denied.");
  });

  it("denies capabilities never granted", () => {
    expect(() =>
      requirePluginCapability(s, "record:update", { tableId: "t-a", fieldId: "f-1" }),
    ).toThrow(CapabilityDeniedError);
  });

  it("empty lists grant nothing, null is an explicit wildcard", () => {
    expect(() =>
      requirePluginCapability(scope([read([], [])]), "record:read", { tableId: "t-a" }),
    ).toThrow();
    expect(() =>
      requirePluginCapability(scope([read(null, null)]), "record:read", {
        tableId: "anything",
        fieldId: "x",
      }),
    ).not.toThrow();
  });

  it("does not widen when a restricted dimension is omitted from the request", () => {
    expect(() => requirePluginCapability(s, "record:read", {})).toThrow();
    const incidentScoped = scope([read(null, null, ["inc-1"])]);
    expect(() =>
      requirePluginCapability(incidentScoped, "record:read", { tableId: "t" }),
    ).toThrow();
    expect(() =>
      requirePluginCapability(incidentScoped, "record:read", { tableId: "t", incidentId: "inc-2" }),
    ).toThrow();
    expect(() =>
      requirePluginCapability(incidentScoped, "record:read", { tableId: "t", incidentId: "inc-1" }),
    ).not.toThrow();
  });

  it("denies after expiry", () => {
    const expired = scope([read(null, null)], new Date(1000));
    expect(() => requirePluginCapability(expired, "record:read", {}, new Date(2000))).toThrow(
      CapabilityDeniedError,
    );
  });

  it("requirePluginFields checks every field", () => {
    expect(() =>
      requirePluginFields(s, "record:read", { tableId: "t-a" }, ["f-1", "f-2"]),
    ).not.toThrow();
    expect(() =>
      requirePluginFields(s, "record:read", { tableId: "t-a" }, ["f-1", "f-3"]),
    ).toThrow();
  });
});

describe("field redaction", () => {
  it("lists granted fields and strips everything else", () => {
    const s = scope([read(["t-a"], ["f-1"]), read(["t-a"], ["f-2"])]);
    expect(grantedFieldIds(s, "record:read", { tableId: "t-a" })).toEqual(["f-1", "f-2"]);
    expect(grantedFieldIds(s, "record:read", { tableId: "t-b" })).toEqual([]);
    expect(redactValues({ "f-1": 1, "f-2": 2, secret: 3 }, ["f-1", "f-2"])).toEqual({
      "f-1": 1,
      "f-2": 2,
    });
    expect(redactValues({ a: 1 }, null)).toEqual({ a: 1 });
    expect(redactValues({ a: 1 }, [])).toEqual({});
  });
});

describe("grantsFromComponentCapabilities", () => {
  it("maps record capabilities and drops unbridged ones", () => {
    const grants = grantsFromComponentCapabilities([
      { type: "read-records", tableIds: ["t"], fieldIds: ["f"] },
      { type: "update-records", tableIds: ["t"], fieldIds: ["f"] },
      { type: "subscribe-records", tableIds: ["t"], fieldIds: [] },
      { type: "outbound-http", allowedHosts: ["example.com"] },
      { type: "workflow-action", actionKeys: ["x"] },
    ]);
    expect(grants.map((g) => g.capability)).toEqual([
      "record:read",
      "record:update",
      "record:subscribe",
    ]);
    expect(grants[0]?.incidentIds).toBeNull();
  });
});
