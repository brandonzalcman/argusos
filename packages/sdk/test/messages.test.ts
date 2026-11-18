import { describe, expect, it } from "vitest";
import {
  ProtocolError,
  parseHostToPluginMessage,
  parsePluginToHostMessage,
} from "../src/protocol/messages.js";
import {
  clampSandboxHeight,
  parseSandboxLoadMessage,
  parseSandboxToHostMessage,
} from "../src/protocol/sandbox-messages.js";

const envelope = {
  protocolVersion: "1.0",
  pluginId: "c",
  installationId: "sandbox",
  sessionId: "s",
  messageId: "m1",
  correlationId: null,
  sentAt: "2026-01-01T00:00:00.000Z",
};

describe("plugin to host parser", () => {
  const get = {
    ...envelope,
    kind: "record.get",
    incidentId: null,
    tableId: "t",
    recordId: "r",
    fieldIds: null,
  };

  it("accepts a well-formed request", () => {
    expect(parsePluginToHostMessage(get).kind).toBe("record.get");
  });

  it("rejects malformed input", () => {
    const bad = [
      null,
      "x",
      1,
      [],
      {},
      { ...get, protocolVersion: "2.0" },
      { ...get, tableId: "" },
      { ...get, tableId: 5 },
      { ...get, fieldIds: "a" },
    ];
    for (const input of bad) expect(() => parsePluginToHostMessage(input)).toThrow(ProtocolError);
  });

  it("rejects unknown kinds, including host-to-plugin kinds", () => {
    expect(() => parsePluginToHostMessage({ ...get, kind: "record.delete" })).toThrow(
      ProtocolError,
    );
    expect(() => parsePluginToHostMessage({ ...envelope, kind: "host.acknowledged" })).toThrow(
      ProtocolError,
    );
  });

  it("rejects oversized and deeply nested payloads", () => {
    const update = {
      ...envelope,
      kind: "record.update",
      incidentId: null,
      tableId: "t",
      recordId: "r",
      expectedVersion: 1,
    };
    expect(() =>
      parsePluginToHostMessage({ ...update, values: { f: "x".repeat(300_000) } }),
    ).toThrow(/too large/);
    let deep: unknown = 1;
    for (let i = 0; i < 40; i++) deep = { a: deep };
    expect(() => parsePluginToHostMessage({ ...update, values: { f: deep } })).toThrow(
      ProtocolError,
    );
    expect(() =>
      parsePluginToHostMessage({
        ...get,
        fieldIds: Array.from({ length: 600 }, (_, i) => `f${i}`),
      }),
    ).toThrow(ProtocolError);
  });

  it("rejects non-plain objects, non-finite numbers and functions", () => {
    expect(() => parsePluginToHostMessage({ ...get, extra: new Date() })).toThrow(ProtocolError);
    expect(() => parsePluginToHostMessage({ ...get, extra: Number.NaN })).toThrow(ProtocolError);
    expect(() => parsePluginToHostMessage({ ...get, extra: () => 1 })).toThrow(ProtocolError);
  });

  it("does not echo payload content in errors and drops unknown keys", () => {
    try {
      parsePluginToHostMessage({ ...get, tableId: "SECRET-VALUE".repeat(100) });
    } catch (e) {
      expect(String((e as Error).message)).not.toContain("SECRET");
    }
    const parsed = parsePluginToHostMessage({ ...get, tenantId: "other-tenant" });
    expect("tenantId" in parsed).toBe(false);
  });

  it("requires a non-negative integer expectedVersion", () => {
    const update = {
      ...envelope,
      kind: "record.update",
      incidentId: null,
      tableId: "t",
      recordId: "r",
      values: { f: 1 },
    };
    expect(() => parsePluginToHostMessage({ ...update, expectedVersion: -1 })).toThrow();
    expect(() => parsePluginToHostMessage({ ...update, expectedVersion: 1.5 })).toThrow();
    expect(parsePluginToHostMessage({ ...update, expectedVersion: 3 }).kind).toBe("record.update");
  });
});

describe("host to plugin parser", () => {
  it("accepts record results and errors, rejects bad codes and unknown kinds", () => {
    const result = {
      ...envelope,
      kind: "record.result",
      record: { id: "r", tableId: "t", incidentId: null, version: 1, values: { f: 1 } },
    };
    expect(parseHostToPluginMessage(result).kind).toBe("record.result");
    expect(
      parseHostToPluginMessage({
        ...envelope,
        kind: "host.error",
        code: "capability-denied",
        safeMessage: "no",
      }).kind,
    ).toBe("host.error");
    expect(() =>
      parseHostToPluginMessage({ ...envelope, kind: "host.error", code: "weird", safeMessage: "" }),
    ).toThrow(ProtocolError);
    expect(() => parseHostToPluginMessage({ ...envelope, kind: "nope" })).toThrow(ProtocolError);
    expect(() =>
      parseHostToPluginMessage({ ...result, record: { ...result.record, version: -1 } }),
    ).toThrow(ProtocolError);
  });
});

describe("sandbox control messages", () => {
  it("parses frame messages and rejects unknown or malformed ones", () => {
    expect(parseSandboxToHostMessage({ kind: "sandbox.boot" }).kind).toBe("sandbox.boot");
    expect(
      parseSandboxToHostMessage({ kind: "sandbox.resize", sessionId: "s", height: 120 }).kind,
    ).toBe("sandbox.resize");
    expect(() =>
      parseSandboxToHostMessage({ kind: "sandbox.resize", sessionId: "s", height: -1 }),
    ).toThrow(ProtocolError);
    expect(() => parseSandboxToHostMessage({ kind: "sandbox.exec", sessionId: "s" })).toThrow(
      ProtocolError,
    );
    expect(() =>
      parseSandboxToHostMessage({
        kind: "sandbox.console",
        sessionId: "s",
        level: "log",
        args: Array(20).fill("x"),
      }),
    ).toThrow(ProtocolError);
    expect(() =>
      parseSandboxToHostMessage({
        kind: "sandbox.console",
        sessionId: "s",
        level: "log",
        args: ["x".repeat(5000)],
      }),
    ).toThrow(ProtocolError);
    expect(() =>
      parseSandboxToHostMessage({
        kind: "sandbox.render-error",
        sessionId: "s",
        phase: "x",
        message: "m",
        line: null,
        column: null,
      }),
    ).toThrow(ProtocolError);
  });

  it("load message: drops unsafe theme entries and rejects oversize source", () => {
    const load = {
      kind: "sandbox.load",
      sessionId: "s",
      handshakeNonce: "n",
      componentKey: "c",
      version: 1,
      source: "export default () => null",
      props: {},
      theme: {
        "--argus-color-bg": "#fff",
        "--argus-evil": "red; } body { display:none",
        "--other": "x",
        "--argus-color-fg": "url(javascript:1)</style>",
      },
      density: "compact",
      grantedCapabilities: [],
    };
    expect(parseSandboxLoadMessage(load).theme).toEqual({ "--argus-color-bg": "#fff" });
    expect(() => parseSandboxLoadMessage({ ...load, source: "x".repeat(200_001) })).toThrow(
      ProtocolError,
    );
    expect(() => parseSandboxLoadMessage({ ...load, density: "huge" })).toThrow(ProtocolError);
  });

  it("clamps heights", () => {
    expect(clampSandboxHeight(99_999, 0, 500)).toBe(500);
    expect(clampSandboxHeight(-5, 10, 500)).toBe(10);
    expect(clampSandboxHeight(Number.NaN, 10, 500)).toBe(10);
  });
});
