import type { PluginCapability } from "../protocol/capabilities.js";
import {
  type HostErrorMessage,
  type HostRecord,
  type HostToPluginMessage,
  PLUGIN_PROTOCOL_VERSION,
  type PluginToHostMessage,
} from "../protocol/messages.js";
import { parseHostToPluginMessage } from "../protocol/parse.js";
import { isSandboxControlKind } from "../protocol/sandbox-messages.js";

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

/** Rejection raised for host errors, timeouts and teardown. `code` mirrors the host error codes. */
export class HostRequestError extends Error {
  readonly code: HostErrorMessage["code"] | "timeout" | "aborted";
  constructor(code: HostRequestError["code"], safeMessage: string) {
    super(safeMessage);
    this.name = "HostRequestError";
    this.code = code;
  }
}

export interface ArgusPluginClient {
  /** Capabilities the host reported at handshake; UI hint only, the host enforces every request. */
  readonly grantedCapabilities: readonly PluginCapability[];
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
  /** Exact origin of the embedding host; messages from any other origin are dropped. */
  readonly hostOrigin: string;
  readonly hostWindow: Window;
  readonly pluginWindow: Window;
  readonly requestTimeoutMs: number;
  /** Session id and nonce the host issued (via the sandbox load message). */
  readonly sessionId: string;
  readonly handshakeNonce: string;
}

interface Pending {
  readonly resolve: (message: HostToPluginMessage) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly onSubscribed?: (subscriptionId: string) => void;
  cleanupAbort?: () => void;
}

type Draft = PluginToHostMessage extends infer M
  ? M extends PluginToHostMessage
    ? Omit<
        M,
        | "protocolVersion"
        | "pluginId"
        | "installationId"
        | "sessionId"
        | "messageId"
        | "correlationId"
        | "sentAt"
      >
    : never
  : never;

/**
 * Perform the sandboxed iframe handshake and create the typed plugin client.
 * Every inbound frame is checked for exact host origin and host window, then schema-validated; no
 * wildcard target origins are used. Pending requests reject on timeout, abort, error, or disposal.
 * Errors: rejects when the handshake fails or times out.
 */
export async function createIframeClient(options: IframeClientOptions): Promise<ArgusPluginClient> {
  const pending = new Map<string, Pending>();
  const handlers = new Map<string, (record: HostRecord, cursor: string) => void>();
  let disposed = false;
  let granted: readonly PluginCapability[] = [];

  const newId = (): string => globalThis.crypto.randomUUID();

  const post = (draft: Draft, messageId: string): void => {
    options.hostWindow.postMessage(
      {
        ...draft,
        protocolVersion: PLUGIN_PROTOCOL_VERSION,
        pluginId: options.pluginId,
        installationId: options.installationId,
        sessionId: options.sessionId,
        messageId,
        correlationId: null,
        sentAt: new Date().toISOString(),
      },
      options.hostOrigin,
    );
  };

  const settle = (correlationId: string | null, message: HostToPluginMessage): void => {
    if (correlationId === null) return;
    const entry = pending.get(correlationId);
    if (!entry) return;
    pending.delete(correlationId);
    clearTimeout(entry.timer);
    entry.cleanupAbort?.();
    if (message.kind === "host.error") {
      entry.reject(new HostRequestError(message.code, message.safeMessage));
    } else {
      if (message.kind === "record.subscribed") entry.onSubscribed?.(message.subscriptionId);
      entry.resolve(message);
    }
  };

  const failAll = (error: Error): void => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.cleanupAbort?.();
      entry.reject(error);
      pending.delete(id);
    }
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    if (disposed) return;
    if (event.origin !== options.hostOrigin || event.source !== options.hostWindow) return;
    if (isSandboxControlKind(event.data)) return;
    let message: HostToPluginMessage;
    try {
      message = parseHostToPluginMessage(event.data);
    } catch {
      return;
    }
    if (message.pluginId !== options.pluginId || message.sessionId !== options.sessionId) return;
    if (message.kind === "record.changed") {
      handlers.get(message.subscriptionId)?.(message.record, message.cursor);
      return;
    }
    if (message.kind === "host.error" && message.code === "protocol-ended") {
      void teardown(new HostRequestError("protocol-ended", message.safeMessage));
      return;
    }
    settle(message.correlationId, message);
  };

  const teardown = async (error: Error): Promise<void> => {
    if (disposed) return;
    disposed = true;
    options.pluginWindow.removeEventListener("message", onMessage as EventListener);
    failAll(error);
    handlers.clear();
  };

  const request = (
    draft: Draft,
    signal?: AbortSignal,
    onSubscribed?: (subscriptionId: string) => void,
  ): Promise<HostToPluginMessage> => {
    if (disposed)
      return Promise.reject(new HostRequestError("protocol-ended", "The session has ended."));
    if (signal?.aborted) return Promise.reject(new HostRequestError("aborted", "Aborted."));
    return new Promise<HostToPluginMessage>((resolve, reject) => {
      const messageId = newId();
      const timer = setTimeout(() => {
        pending.delete(messageId);
        reject(new HostRequestError("timeout", "The host did not respond in time."));
      }, options.requestTimeoutMs);
      const entry: Pending = { resolve, reject, timer, ...(onSubscribed ? { onSubscribed } : {}) };
      if (signal) {
        const onAbort = (): void => {
          pending.delete(messageId);
          clearTimeout(timer);
          reject(new HostRequestError("aborted", "Aborted."));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        entry.cleanupAbort = () => signal.removeEventListener("abort", onAbort);
      }
      pending.set(messageId, entry);
      post(draft, messageId);
    });
  };

  options.pluginWindow.addEventListener("message", onMessage as EventListener);

  // Handshake: plugin.hello with the host-issued nonce, answered by host.hello echoing it.
  try {
    const reply = await request({
      kind: "plugin.hello",
      supportedProtocolVersions: [PLUGIN_PROTOCOL_VERSION],
      manifestHash: options.manifestHash,
      handshakeNonce: options.handshakeNonce,
    });
    if (reply.kind !== "host.hello" || reply.handshakeNonce !== options.handshakeNonce) {
      throw new HostRequestError("invalid-message", "Handshake rejected.");
    }
    granted = reply.grantedCapabilities;
  } catch (error: unknown) {
    await teardown(error instanceof Error ? error : new Error("Handshake failed."));
    throw error;
  }

  const unsubscribeRemote = (subscriptionId: string): void => {
    handlers.delete(subscriptionId);
    if (!disposed) post({ kind: "record.unsubscribe", subscriptionId }, newId());
  };

  return {
    get grantedCapabilities() {
      return granted;
    },
    async getRecord(selector, signal) {
      const reply = await request({ kind: "record.get", ...selector, fieldIds: null }, signal);
      if (reply.kind !== "record.result")
        throw new HostRequestError("invalid-message", "Unexpected reply.");
      return reply.record;
    },
    async updateRecord(selector, values, expectedVersion, signal) {
      const reply = await request(
        { kind: "record.update", ...selector, expectedVersion, values },
        signal,
      );
      if (reply.kind !== "record.result" || reply.record === null) {
        throw new HostRequestError("invalid-message", "Unexpected reply.");
      }
      return reply.record;
    },
    async subscribe(selector, onChange, signal) {
      let id: string | null = null;
      const reply = await request(
        { kind: "record.subscribe", ...selector },
        signal,
        (subscriptionId) => {
          id = subscriptionId;
          handlers.set(subscriptionId, onChange);
        },
      );
      if (reply.kind !== "record.subscribed" || id === null) {
        throw new HostRequestError("invalid-message", "Unexpected reply.");
      }
      const subscriptionId: string = id;
      let closed = false;
      return {
        subscriptionId,
        async close() {
          if (closed) return;
          closed = true;
          unsubscribeRemote(subscriptionId);
        },
      };
    },
    async dispose() {
      if (disposed) return;
      for (const subscriptionId of [...handlers.keys()]) unsubscribeRemote(subscriptionId);
      post({ kind: "plugin.dispose", reason: "plugin-shutdown" }, newId());
      await teardown(new HostRequestError("protocol-ended", "The session has ended."));
    },
  };
}
