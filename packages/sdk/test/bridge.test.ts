import { describe, expect, it, vi } from "vitest";
import { createHostBridge, type HostBridgeServices } from "../src/host/bridge.js";
import type { CapabilityGrant, PluginSecurityScope } from "../src/protocol/capabilities.js";
import type { HostRecord } from "../src/protocol/messages.js";

class FakeWindow {
  readonly posted: Array<{ message: Record<string, unknown>; origin: string }> = [];
  private readonly listeners = new Set<(event: Event) => void>();
  addEventListener(_type: string, listener: (event: Event) => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: string, listener: (event: Event) => void): void {
    this.listeners.delete(listener);
  }
  postMessage(message: Record<string, unknown>, origin: string): void {
    this.posted.push({ message, origin });
  }
  get listenerCount(): number {
    return this.listeners.size;
  }
  dispatch(event: unknown): void {
    for (const l of [...this.listeners]) l(event as Event);
  }
}

const grant = (
  capability: CapabilityGrant["capability"],
  tableIds: string[],
  fieldIds: string[],
): CapabilityGrant => ({ capability, tableIds, fieldIds, incidentIds: null, destinations: null });

const record: HostRecord = {
  id: "r1",
  tableId: "t-a",
  incidentId: null,
  version: 4,
  values: { "f-1": "visible", "f-hidden": "secret" },
};

function setup(grants: CapabilityGrant[], overrides: Partial<HostBridgeServices> = {}) {
  const plugin = new FakeWindow();
  const host = new FakeWindow();
  const services: HostBridgeServices = {
    getRecord: vi.fn(async () => record),
    updateRecord: vi.fn(async () => record),
    subscribe: vi.fn(async () => ({ subscriptionId: "sub-1", close: async () => undefined })),
    ...overrides,
  };
  const scope: PluginSecurityScope = {
    tenantId: "t",
    installationId: "sandbox",
    actorUserId: "u",
    actorPositionId: null,
    grants,
    authorizationRevision: 1,
    expiresAt: null,
  };
  const bridge = createHostBridge({
    manifest: {
      id: "comp",
      version: "1",
      apiVersion: "1.0",
      displayName: "c",
      iframeEntry: null,
      serverEntry: null,
      requestedCapabilities: [],
      requestedEgressOrigins: [],
    },
    scope,
    expectedPluginOrigin: "null",
    pluginWindow: plugin as unknown as Window,
    hostWindow: host as unknown as Window,
    services,
    maximumMessageBytes: 64 * 1024,
  });
  let n = 0;
  const msg = (kind: string, extra: Record<string, unknown>) => ({
    protocolVersion: "1.0",
    pluginId: "comp",
    installationId: "sandbox",
    sessionId: bridge.sessionId,
    messageId: `m${++n}`,
    correlationId: null,
    sentAt: "2026-01-01T00:00:00.000Z",
    kind,
    ...extra,
  });
  const send = async (data: unknown, over: { origin?: string; source?: unknown } = {}) =>
    bridge.handleMessage({
      origin: over.origin ?? "null",
      source: over.source ?? plugin,
      data,
    } as unknown as MessageEvent<unknown>);
  const hello = () =>
    send(
      msg("plugin.hello", {
        supportedProtocolVersions: ["1.0"],
        manifestHash: "",
        handshakeNonce: bridge.handshakeNonce,
      }),
    );
  const last = () => plugin.posted.at(-1)?.message;
  return { bridge, plugin, host, services, msg, send, hello, last };
}

const get = { incidentId: null, tableId: "t-a", recordId: "r1", fieldIds: null };

describe("host bridge", () => {
  it("completes the nonce handshake and reports granted capabilities", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])]);
    const started = t.bridge.start();
    await t.hello();
    await started;
    expect(t.last()).toMatchObject({ kind: "host.hello", grantedCapabilities: ["record:read"] });
    expect(t.plugin.posted[0]?.origin).toBe("*"); // opaque origin cannot be targeted exactly
  });

  it("rejects a wrong nonce and closes", async () => {
    const t = setup([]);
    void t.bridge.start().catch(() => undefined);
    await t.send(
      t.msg("plugin.hello", {
        supportedProtocolVersions: ["1.0"],
        manifestHash: "",
        handshakeNonce: "nope",
      }),
    );
    expect(t.plugin.posted.some((p) => p.message.kind === "host.hello")).toBe(false);
    expect(t.last()).toMatchObject({ kind: "host.error", code: "protocol-ended" });
  });

  it("ignores wrong-origin and wrong-source messages without closing", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])]);
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    const before = t.plugin.posted.length;
    await t.send(t.msg("record.get", get), { origin: "https://evil.example" });
    await t.send(t.msg("record.get", get), { source: new FakeWindow() });
    expect(t.plugin.posted.length).toBe(before);
    expect(t.services.getRecord).not.toHaveBeenCalled();
    await t.send(t.msg("record.get", get));
    expect(t.last()).toMatchObject({ kind: "record.result" });
  });

  it("requires the handshake before any request", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])]);
    void t.bridge.start().catch(() => undefined);
    await t.send(t.msg("record.get", get));
    expect(t.services.getRecord).not.toHaveBeenCalled();
  });

  it("denies ungranted tables and fields before calling services", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])]);
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    await t.send(t.msg("record.get", { ...get, tableId: "t-other" }));
    expect(t.last()).toMatchObject({ kind: "host.error", code: "capability-denied" });
    await t.send(t.msg("record.get", { ...get, fieldIds: ["f-hidden"] }));
    expect(t.last()).toMatchObject({ kind: "host.error", code: "capability-denied" });
    expect(t.services.getRecord).not.toHaveBeenCalled();
  });

  it("narrows requested fields and redacts returned values host-side", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])]);
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    await t.send(t.msg("record.get", get));
    expect(t.services.getRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fieldIds: ["f-1"] }),
    );
    expect(t.last()).toMatchObject({
      kind: "record.result",
      record: { values: { "f-1": "visible" } },
    });
    expect(JSON.stringify(t.last())).not.toContain("secret");
  });

  it("denies updates to ungranted fields and passes expectedVersion for granted ones", async () => {
    const t = setup([
      grant("record:update", ["t-a"], ["f-1"]),
      grant("record:read", ["t-a"], ["f-1"]),
    ]);
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    const base = { incidentId: null, tableId: "t-a", recordId: "r1", expectedVersion: 4 };
    await t.send(t.msg("record.update", { ...base, values: { "f-hidden": "x" } }));
    expect(t.last()).toMatchObject({ code: "capability-denied" });
    expect(t.services.updateRecord).not.toHaveBeenCalled();
    await t.send(t.msg("record.update", { ...base, values: { "f-1": "x" } }));
    expect(t.services.updateRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { "f-1": "x" },
      4,
    );
  });

  it("maps service errors to safe codes without leaking messages", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])], {
      getRecord: async () => {
        throw Object.assign(new Error("SELECT * FROM secret_table failed"), { code: "not-found" });
      },
    });
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    await t.send(t.msg("record.get", get));
    expect(t.last()).toMatchObject({ code: "not-found" });
    expect(JSON.stringify(t.last())).not.toContain("secret_table");
  });

  it("requires read access for subscriptions and redacts emitted records", async () => {
    const emitRef: { fn: ((r: HostRecord, c: string) => Promise<void>) | null } = { fn: null };
    const t = setup(
      [grant("record:subscribe", ["t-a"], ["f-1"]), grant("record:read", ["t-a"], ["f-1"])],
      {
        subscribe: async (_s, _sel, e) => {
          emitRef.fn = e;
          return { subscriptionId: "sub-9", close: async () => undefined };
        },
      },
    );
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    await t.send(t.msg("record.subscribe", { incidentId: null, tableId: "t-a", viewId: null }));
    expect(t.last()).toMatchObject({ kind: "record.subscribed", subscriptionId: "sub-9" });
    await emitRef.fn?.(record, "c1");
    expect(t.last()).toMatchObject({
      kind: "record.changed",
      record: { values: { "f-1": "visible" } },
    });
    expect(JSON.stringify(t.last())).not.toContain("secret");

    const noRead = setup([grant("record:subscribe", ["t-a"], ["f-1"])]);
    void noRead.bridge.start().catch(() => undefined);
    await noRead.hello();
    await noRead.send(
      noRead.msg("record.subscribe", { incidentId: null, tableId: "t-a", viewId: null }),
    );
    expect(noRead.last()).toMatchObject({ code: "capability-denied" });
    expect(noRead.services.subscribe).not.toHaveBeenCalled();
  });

  it("closes on replayed message ids and wrong session", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])]);
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    const m = t.msg("record.get", get);
    await t.send(m);
    await t.send(m);
    expect(t.last()).toMatchObject({ code: "protocol-ended" });

    const u = setup([]);
    void u.bridge.start().catch(() => undefined);
    await u.send({ ...u.msg("record.get", get), sessionId: "other" });
    expect(u.last()).toMatchObject({ code: "protocol-ended" });
  });

  it("rejects malformed messages and rate limits", async () => {
    const t = setup([grant("record:read", ["t-a"], ["f-1"])]);
    void t.bridge.start().catch(() => undefined);
    await t.hello();
    await t.send({ kind: "record.get" });
    expect(t.last()).toMatchObject({ code: "invalid-message" });
    // sandbox control messages are not the bridge's business
    const before = t.plugin.posted.length;
    await t.send({ kind: "sandbox.heartbeat", sessionId: "x" });
    expect(t.plugin.posted.length).toBe(before);
  });

  it("dispose is idempotent, detaches the listener and ends the protocol", async () => {
    const t = setup([]);
    void t.bridge.start().catch(() => undefined);
    expect(t.host.listenerCount).toBe(1);
    await t.bridge.dispose("navigation");
    await t.bridge.dispose("navigation");
    expect(t.host.listenerCount).toBe(0);
    expect(t.plugin.posted.filter((p) => p.message.code === "protocol-ended")).toHaveLength(1);
  });

  it.todo("revokes grants mid-session when the authorization revision changes");
});
