import type { PluginCapability } from "./capabilities.js";
import {
  type HostErrorMessage,
  type HostRecord,
  type HostToPluginMessage,
  PLUGIN_PROTOCOL_VERSION,
  type PluginMessageEnvelope,
  type PluginToHostMessage,
} from "./messages.js";

/** Safe protocol error; messages never echo payload content. */
export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

/** Default upper bound for a single message (JSON size estimate). */
export const DEFAULT_MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_ID_LENGTH = 256;
const MAX_JSON_DEPTH = 16;
const MAX_FIELD_IDS = 500;

export type Obj = Record<string, unknown>;

export function fail(reason: string): never {
  throw new ProtocolError(`Invalid message: ${reason}.`);
}

export function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function strField(o: Obj, key: string, max = MAX_ID_LENGTH, allowEmpty = false): string {
  const v = o[key];
  if (typeof v !== "string" || v.length > max || (!allowEmpty && v.length === 0)) {
    fail(`field ${key}`);
  }
  return v;
}

export function nullableStrField(o: Obj, key: string, max = MAX_ID_LENGTH): string | null {
  if (o[key] === null) return null;
  return strField(o, key, max);
}

/** Verify a value is plain JSON within depth and size budgets (no functions, symbols, odd prototypes). */
export function assertJsonValue(value: unknown, maxBytes: number): void {
  let budget = maxBytes;
  const walk = (v: unknown, depth: number): void => {
    if (depth > MAX_JSON_DEPTH) fail("too deeply nested");
    if (v === null || typeof v === "boolean") {
      budget -= 4;
    } else if (typeof v === "number") {
      if (!Number.isFinite(v)) fail("non-finite number");
      budget -= 8;
    } else if (typeof v === "string") {
      budget -= v.length;
    } else if (Array.isArray(v)) {
      for (const item of v) {
        walk(item, depth + 1);
        if (budget < 0) break;
      }
    } else if (isObj(v)) {
      const proto = Object.getPrototypeOf(v) as unknown;
      if (proto !== Object.prototype && proto !== null) fail("non-plain object");
      for (const [k, item] of Object.entries(v)) {
        budget -= k.length;
        walk(item, depth + 1);
        if (budget < 0) break;
      }
    } else {
      fail("unsupported value");
    }
    if (budget < 0) fail("message too large");
  };
  walk(value, 0);
}

function parseEnvelope(o: Obj): PluginMessageEnvelope {
  if (o["protocolVersion"] !== PLUGIN_PROTOCOL_VERSION) fail("unsupported protocol version");
  return {
    protocolVersion: PLUGIN_PROTOCOL_VERSION,
    pluginId: strField(o, "pluginId"),
    installationId: strField(o, "installationId"),
    sessionId: strField(o, "sessionId"),
    messageId: strField(o, "messageId"),
    correlationId: nullableStrField(o, "correlationId"),
    sentAt: strField(o, "sentAt", 64),
  };
}

function nonNegativeInt(o: Obj, key: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) fail(`field ${key}`);
  return v;
}

function fieldIdList(o: Obj, key: string): readonly string[] | null {
  const v = o[key];
  if (v === null) return null;
  if (!Array.isArray(v) || v.length > MAX_FIELD_IDS) fail(`field ${key}`);
  return v.map((x: unknown) => {
    if (typeof x !== "string" || x.length === 0 || x.length > MAX_ID_LENGTH) fail(`field ${key}`);
    return x;
  });
}

function parseRecord(value: unknown, maxBytes: number): HostRecord {
  if (!isObj(value)) fail("record");
  const values = value["values"];
  if (!isObj(values)) fail("values");
  assertJsonValue(values, maxBytes);
  return {
    id: strField(value, "id"),
    tableId: strField(value, "tableId"),
    incidentId: nullableStrField(value, "incidentId"),
    version: nonNegativeInt(value, "version"),
    values: values as Readonly<Record<string, unknown>>,
  };
}

function parseCommon(input: unknown, maxBytes: number): { o: Obj; env: PluginMessageEnvelope } {
  if (!isObj(input)) fail("not an object");
  assertJsonValue(input, maxBytes);
  return { o: input, env: parseEnvelope(input) };
}

const HOST_ERROR_CODES: readonly HostErrorMessage["code"][] = [
  "invalid-message",
  "capability-denied",
  "not-found",
  "version-conflict",
  "rate-limited",
  "unavailable",
  "protocol-ended",
];

/**
 * Validate an unknown host-to-plugin message and its envelope (strict, bounded, JSON-only).
 * Origin/source checks are mandatory separately; schema validation alone is not authentication.
 * Errors: throws ProtocolError with a payload-free message. Unknown kinds are rejected.
 */
export function parseHostToPluginMessage(
  input: unknown,
  maxBytes: number = DEFAULT_MAX_MESSAGE_BYTES,
): HostToPluginMessage {
  const { o, env } = parseCommon(input, maxBytes);
  switch (o["kind"]) {
    case "host.hello": {
      const caps = o["grantedCapabilities"];
      if (!Array.isArray(caps) || caps.length > 32 || caps.some((c: unknown) => typeof c !== "string")) {
        fail("grantedCapabilities");
      }
      return {
        ...env,
        kind: "host.hello",
        handshakeNonce: strField(o, "handshakeNonce"),
        grantedCapabilities: caps as PluginCapability[],
        authorizationRevision: nonNegativeInt(o, "authorizationRevision"),
      };
    }
    case "record.result": {
      const record = o["record"];
      return {
        ...env,
        kind: "record.result",
        record: record === null ? null : parseRecord(record, maxBytes),
      };
    }
    case "record.subscribed":
      return { ...env, kind: "record.subscribed", subscriptionId: strField(o, "subscriptionId") };
    case "record.changed":
      return {
        ...env,
        kind: "record.changed",
        subscriptionId: strField(o, "subscriptionId"),
        cursor: strField(o, "cursor"),
        record: parseRecord(o["record"], maxBytes),
      };
    case "host.acknowledged":
      return { ...env, kind: "host.acknowledged" };
    case "host.error": {
      const code = o["code"] as HostErrorMessage["code"];
      if (!HOST_ERROR_CODES.includes(code)) fail("error code");
      return {
        ...env,
        kind: "host.error",
        code,
        safeMessage: strField(o, "safeMessage", 500, true),
      };
    }
    default:
      return fail("unknown kind");
  }
}

/**
 * Validate an unknown plugin-to-host message and its envelope (strict, bounded, JSON-only).
 * Origin and source-window checks are mandatory separately and happen before this call.
 * Security: tenant/actor claims never override the host-derived PluginSecurityScope; the envelope
 * has no tenant/actor fields and unknown keys are dropped, never trusted.
 * TODO(implementation): replay protection beyond per-session messageId uniqueness (host bridge).
 */
export function parsePluginToHostMessage(
  input: unknown,
  maxBytes: number = DEFAULT_MAX_MESSAGE_BYTES,
): PluginToHostMessage {
  const { o, env } = parseCommon(input, maxBytes);
  switch (o["kind"]) {
    case "plugin.hello": {
      const versions = o["supportedProtocolVersions"];
      if (
        !Array.isArray(versions) ||
        versions.length > 8 ||
        versions.some((v: unknown) => typeof v !== "string")
      ) {
        fail("supportedProtocolVersions");
      }
      return {
        ...env,
        kind: "plugin.hello",
        supportedProtocolVersions: versions as string[],
        manifestHash: strField(o, "manifestHash", 256, true),
        handshakeNonce: strField(o, "handshakeNonce"),
      };
    }
    case "record.get":
      return {
        ...env,
        kind: "record.get",
        incidentId: nullableStrField(o, "incidentId"),
        tableId: strField(o, "tableId"),
        recordId: strField(o, "recordId"),
        fieldIds: fieldIdList(o, "fieldIds"),
      };
    case "record.update": {
      const values = o["values"];
      if (!isObj(values)) fail("values");
      return {
        ...env,
        kind: "record.update",
        incidentId: nullableStrField(o, "incidentId"),
        tableId: strField(o, "tableId"),
        recordId: strField(o, "recordId"),
        expectedVersion: nonNegativeInt(o, "expectedVersion"),
        values: values as Readonly<Record<string, unknown>>,
      };
    }
    case "record.subscribe":
      return {
        ...env,
        kind: "record.subscribe",
        incidentId: nullableStrField(o, "incidentId"),
        tableId: strField(o, "tableId"),
        viewId: nullableStrField(o, "viewId"),
      };
    case "record.unsubscribe":
      return { ...env, kind: "record.unsubscribe", subscriptionId: strField(o, "subscriptionId") };
    case "plugin.dispose": {
      const reason = o["reason"];
      if (
        reason !== "navigation" &&
        reason !== "logout" &&
        reason !== "host-teardown" &&
        reason !== "plugin-shutdown"
      ) {
        fail("reason");
      }
      return { ...env, kind: "plugin.dispose", reason };
    }
    default:
      return fail("unknown kind");
  }
}
