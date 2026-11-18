import { assertJsonValue, fail, isObj, type Obj, strField } from "./parse.js";

/** Mirrors CUSTOM_COMPONENT_SOURCE_MAX_LENGTH in @argus/schema (not imported: keeps zod out of the iframe bundle). */
export const SANDBOX_SOURCE_MAX_LENGTH = 200_000;
export const SANDBOX_LOAD_MAX_BYTES = 1_000_000;
export const SANDBOX_CONTROL_MAX_BYTES = 16_384;
export const SANDBOX_MIN_HEIGHT = 0;
export const SANDBOX_MAX_HEIGHT = 4_000;
export const SANDBOX_CONSOLE_MAX_ARGS = 8;
export const SANDBOX_CONSOLE_MAX_LENGTH = 2_000;

export type SandboxDensity = "compact" | "comfortable";
export type SandboxConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

/** Host to frame: compile and render this source. Re-sent on every source/props/theme change. */
export interface SandboxLoadMessage {
  readonly kind: "sandbox.load";
  readonly sessionId: string;
  readonly handshakeNonce: string;
  readonly componentKey: string;
  readonly version: number;
  readonly source: string;
  readonly props: Readonly<Record<string, unknown>>;
  /** Resolved CSS variable values keyed by variable name, e.g. "--argus-color-bg". */
  readonly theme: Readonly<Record<string, string>>;
  readonly density: SandboxDensity;
  /** Capability labels, for UI hints only; the host enforces every request independently. */
  readonly grantedCapabilities: readonly string[];
}

/** Frame to host: the runtime script is running and waits for a load message. */
export interface SandboxBootMessage {
  readonly kind: "sandbox.boot";
}
export interface SandboxReadyMessage {
  readonly kind: "sandbox.ready";
  readonly sessionId: string;
  readonly version: number;
}
export interface SandboxRenderErrorMessage {
  readonly kind: "sandbox.render-error";
  readonly sessionId: string;
  readonly phase: "compile" | "execute" | "render";
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
}
export interface SandboxConsoleMessage {
  readonly kind: "sandbox.console";
  readonly sessionId: string;
  readonly level: SandboxConsoleLevel;
  readonly args: readonly string[];
}
export interface SandboxResizeMessage {
  readonly kind: "sandbox.resize";
  readonly sessionId: string;
  readonly height: number;
}
export interface SandboxHeartbeatMessage {
  readonly kind: "sandbox.heartbeat";
  readonly sessionId: string;
}

export type SandboxToHostControlMessage =
  | SandboxBootMessage
  | SandboxReadyMessage
  | SandboxRenderErrorMessage
  | SandboxConsoleMessage
  | SandboxResizeMessage
  | SandboxHeartbeatMessage;

export function isSandboxControlKind(input: unknown): boolean {
  return (
    isObj(input) && typeof input["kind"] === "string" && input["kind"].startsWith("sandbox.")
  );
}

const CONSOLE_LEVELS: readonly SandboxConsoleLevel[] = ["log", "info", "warn", "error", "debug"];

function intOrNull(o: Obj, key: string): number | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 1_000_000) fail(`field ${key}`);
  return v;
}

/** Validate a frame-to-host control message. Throws ProtocolError when malformed/oversized/unknown. */
export function parseSandboxToHostMessage(input: unknown): SandboxToHostControlMessage {
  if (!isObj(input)) fail("not an object");
  assertJsonValue(input, SANDBOX_CONTROL_MAX_BYTES);
  switch (input["kind"]) {
    case "sandbox.boot":
      return { kind: "sandbox.boot" };
    case "sandbox.ready": {
      const version = input["version"];
      if (typeof version !== "number" || !Number.isInteger(version)) fail("version");
      return { kind: "sandbox.ready", sessionId: strField(input, "sessionId"), version };
    }
    case "sandbox.render-error": {
      const phase = input["phase"];
      if (phase !== "compile" && phase !== "execute" && phase !== "render") fail("phase");
      return {
        kind: "sandbox.render-error",
        sessionId: strField(input, "sessionId"),
        phase,
        message: strField(input, "message", SANDBOX_CONSOLE_MAX_LENGTH, true),
        line: intOrNull(input, "line"),
        column: intOrNull(input, "column"),
      };
    }
    case "sandbox.console": {
      const level = input["level"] as SandboxConsoleLevel;
      const args = input["args"];
      if (!CONSOLE_LEVELS.includes(level)) fail("level");
      if (
        !Array.isArray(args) ||
        args.length > SANDBOX_CONSOLE_MAX_ARGS ||
        args.some((a: unknown) => typeof a !== "string" || a.length > SANDBOX_CONSOLE_MAX_LENGTH)
      ) {
        fail("args");
      }
      return {
        kind: "sandbox.console",
        sessionId: strField(input, "sessionId"),
        level,
        args: args as string[],
      };
    }
    case "sandbox.resize": {
      const height = input["height"];
      if (typeof height !== "number" || !Number.isFinite(height) || height < 0) fail("height");
      return { kind: "sandbox.resize", sessionId: strField(input, "sessionId"), height };
    }
    case "sandbox.heartbeat":
      return { kind: "sandbox.heartbeat", sessionId: strField(input, "sessionId") };
    default:
      return fail("unknown kind");
  }
}

/** Validate a host-to-frame load message (used by the in-frame runtime). */
export function parseSandboxLoadMessage(input: unknown): SandboxLoadMessage {
  if (!isObj(input)) fail("not an object");
  assertJsonValue(input, SANDBOX_LOAD_MAX_BYTES);
  if (input["kind"] !== "sandbox.load") fail("unknown kind");
  const version = input["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) fail("version");
  const source = strField(input, "source", SANDBOX_SOURCE_MAX_LENGTH);
  const props = input["props"];
  const theme = input["theme"];
  if (!isObj(props)) fail("props");
  if (!isObj(theme)) fail("theme");
  const safeTheme: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme)) {
    // Only `--argus-*` custom properties; values must not be able to break out of a declaration.
    if (!/^--argus-[a-z0-9-]{1,80}$/.test(name)) continue;
    if (typeof value !== "string" || value.length > 200 || /[;{}<>\\]/.test(value)) continue;
    safeTheme[name] = value;
  }
  const density = input["density"];
  if (density !== "compact" && density !== "comfortable") fail("density");
  const caps = input["grantedCapabilities"];
  if (!Array.isArray(caps) || caps.length > 32 || caps.some((c: unknown) => typeof c !== "string")) {
    fail("grantedCapabilities");
  }
  return {
    kind: "sandbox.load",
    sessionId: strField(input, "sessionId"),
    handshakeNonce: strField(input, "handshakeNonce"),
    componentKey: strField(input, "componentKey"),
    version,
    source,
    props: props as Readonly<Record<string, unknown>>,
    theme: safeTheme,
    density,
    grantedCapabilities: caps as string[],
  };
}

/** Clamp a reported content height to the permitted range. */
export function clampSandboxHeight(height: number, min = SANDBOX_MIN_HEIGHT, max = SANDBOX_MAX_HEIGHT): number {
  if (!Number.isFinite(height)) return min;
  return Math.min(max, Math.max(min, Math.ceil(height)));
}
