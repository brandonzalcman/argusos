import type { HostRecord } from "../protocol/messages.js";

export interface RecordSelector {
  readonly incidentId: string | null;
  readonly tableId: string;
  readonly recordId: string;
}

export interface RecordSubscriptionSelector {
  readonly incidentId: string | null;
  readonly tableId: string;
  readonly viewId: string | null;
}

export interface PluginSubscription {
  readonly subscriptionId: string;
  /** Unsubscribe and release handlers exactly once; safe to call during dispose. */
  close(): Promise<void>;
}

export interface ArgusPluginClient {
  /** Read one capability/RLS/FLS-filtered record; null never distinguishes hidden from absent. */
  getRecord(selector: RecordSelector, signal?: AbortSignal): Promise<HostRecord | null>;
  /** Patch granted fields using expectedVersion and preserve host-side audit actor/position attribution. */
  updateRecord(
    selector: RecordSelector,
    values: Readonly<Record<string, unknown>>,
    expectedVersion: number,
    signal?: AbortSignal,
  ): Promise<HostRecord>;
  /** Subscribe to FLS-filtered record changes; close must survive reconnect and host teardown. */
  subscribe(
    selector: RecordSubscriptionSelector,
    onChange: (record: HostRecord, cursor: string) => void,
    signal?: AbortSignal,
  ): Promise<PluginSubscription>;
  /** Reject pending requests, close subscriptions, and end the protocol session idempotently. */
  dispose(): Promise<void>;
}

export interface IframeClientOptions {
  readonly pluginId: string;
  readonly installationId: string;
  readonly manifestHash: string;
  readonly hostOrigin: string;
  readonly hostWindow: Window;
  readonly pluginWindow: Window;
  readonly requestTimeoutMs: number;
}

/**
 * TODO(implementation): perform the sandboxed iframe handshake and create the typed plugin client.
 * Input: exact host origin/window, installation identity, manifest hash, and bounded request timeout.
 * Output: an ArgusPluginClient with correlated requests, subscriptions, abort, and disposal behavior.
 * Errors: rejects handshake/timeouts/capability failures and all pending calls after protocol teardown.
 * Depends on: window.postMessage, protocol parsers, secure random nonces, and host bridge.
 * Security: validates origin/source/session on every frame and never uses wildcard target origins.
 */
export function createIframeClient(_options: IframeClientOptions): Promise<ArgusPluginClient> {
  throw new Error("TODO(implementation): createIframeClient");
}
