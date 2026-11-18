import type { PluginManifest, PluginSecurityScope } from "../protocol/capabilities.js";
import type { HostRecord } from "../protocol/messages.js";
import type { PluginLifecycleHooks } from "./lifecycle.js";

export interface PluginLogger {
  /** Write redacted debug details; secrets, record values, tokens, and recipient destinations are forbidden. */
  debug(
    message: string,
    details?: Readonly<Record<string, string | number | boolean | null>>,
  ): void;
  /** Write redacted operational information correlated to tenant/installation by the host. */
  info(message: string, details?: Readonly<Record<string, string | number | boolean | null>>): void;
  /** Write a safe warning without using user-controlled message format strings. */
  warn(message: string, details?: Readonly<Record<string, string | number | boolean | null>>): void;
  /** Write a redacted error code/message; host infrastructure attaches stack and correlation safely. */
  error(
    message: string,
    details?: Readonly<Record<string, string | number | boolean | null>>,
  ): void;
}

export interface PluginRecordApi {
  /** Read one granted record through host RLS/FLS; hidden and absent records are indistinguishable. */
  get(input: {
    readonly incidentId: string | null;
    readonly tableId: string;
    readonly recordId: string;
  }): Promise<HostRecord | null>;
  /** Patch granted fields with expectedVersion and server-owned tenant/incident/audit attribution. */
  update(input: {
    readonly incidentId: string | null;
    readonly tableId: string;
    readonly recordId: string;
    readonly values: Readonly<Record<string, unknown>>;
    readonly expectedVersion: number;
  }): Promise<HostRecord>;
}

export interface PluginFeedApi {
  /** Submit an untrusted source item for host validation, mapping, dedupe, and immutable audit. */
  ingest(input: {
    readonly feedId: string;
    readonly sourceItemId: string;
    readonly sourceUpdatedAt: Date | null;
    readonly payload: Readonly<Record<string, unknown>>;
  }): Promise<{ readonly accepted: boolean; readonly duplicate: boolean }>;
}

export interface PluginAlertApi {
  /** Request an authorized alert; host resolves recipients/content policy and owns delivery/audit. */
  send(input: {
    readonly incidentId: string;
    readonly alertDefinitionId: string;
    readonly recipientGroupId: string;
    readonly parameters: Readonly<Record<string, unknown>>;
  }): Promise<{ readonly alertId: string }>;
}

export interface PluginHttpRequest {
  readonly origin: string;
  readonly path: string;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array | null;
}

export interface PluginHttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

export interface PluginNetworkApi {
  /** Fetch only a declared/granted origin through host SSRF, size, timeout, and redirect controls. */
  fetch(request: PluginHttpRequest, signal?: AbortSignal): Promise<PluginHttpResponse>;
}

export interface ScopedServerPluginApi {
  readonly records: PluginRecordApi;
  readonly feeds: PluginFeedApi;
  readonly alerts: PluginAlertApi;
  readonly network: PluginNetworkApi;
}

export interface ServerPluginContext {
  readonly scope: PluginSecurityScope;
  readonly api: ScopedServerPluginApi;
  readonly logger: PluginLogger;
  readonly signal: AbortSignal;
}

export interface ServerPluginDefinition {
  readonly manifest: PluginManifest;
  /** Activate declared resources only; returned hooks own suspension and exactly-once teardown. */
  activate(context: ServerPluginContext): Promise<PluginLifecycleHooks>;
}

export interface PluginResourceLimits {
  readonly maximumMemoryBytes: number;
  readonly maximumCpuMilliseconds: number;
  readonly maximumEventMilliseconds: number;
  readonly maximumConcurrentEvents: number;
  readonly maximumEgressBytes: number;
}

export interface ServerPluginRuntime {
  /** Install and activate one tenant-scoped definition under its declared resource limits. */
  start(definition: ServerPluginDefinition): Promise<void>;
  /** Revoke tokens, stop events, deactivate hooks, and release the isolated worker exactly once. */
  stop(reason: string): Promise<void>;
}

/**
 * TODO(implementation): validate and freeze a server plugin definition before installation.
 * Input: a plugin manifest and activate hook using only @argus/sdk public contracts.
 * Output: a validated ServerPluginDefinition for the isolated runtime.
 * Errors: throws for unsupported API versions, invalid IDs/entries, or undeclared capabilities.
 * Depends on: manifest runtime schemas and installation policy.
 * Security: definition validation grants nothing; administrator scope is still required at runtime.
 */
export function defineServerPlugin(_definition: ServerPluginDefinition): ServerPluginDefinition {
  throw new Error("TODO(implementation): defineServerPlugin");
}

/**
 * TODO(implementation): create an isolated worker runtime with scoped APIs and no ambient host access.
 * Input: administrator-granted scope and explicit memory/CPU/event/concurrency/egress limits.
 * Output: a ServerPluginRuntime supervising lifecycle, token revocation, quotas, and audit.
 * Errors: throws safe startup errors and terminates isolation on policy/resource violations.
 * Depends on: worker isolation, scoped token broker, API services, egress proxy, and audit telemetry.
 * Security: plugins receive no host secrets or unrestricted filesystem, network, process, or database access.
 */
export function createServerPluginRuntime(
  _scope: PluginSecurityScope,
  _limits: PluginResourceLimits,
): ServerPluginRuntime {
  throw new Error("TODO(implementation): createServerPluginRuntime");
}

export type {
  CapabilityGrant,
  PluginCapability,
  PluginManifest,
  PluginSecurityScope,
} from "../protocol/capabilities.js";
export type {
  PluginLifecycleEvent,
  PluginLifecycleHooks,
  ServerPluginLifecycleState,
} from "./lifecycle.js";
