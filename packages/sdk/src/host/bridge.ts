import {
  CapabilityDeniedError,
  grantedFieldIds,
  type PluginCapability,
  type PluginManifest,
  type PluginSecurityScope,
  redactValues,
  requirePluginCapability,
  requirePluginFields,
} from "../protocol/capabilities.js";
import {
  type HostErrorMessage,
  type HostRecord,
  type HostToPluginMessage,
  PLUGIN_PROTOCOL_VERSION,
  type PluginDisposeMessage,
  type PluginHelloMessage,
  type PluginToHostMessage,
  type RecordGetRequest,
  type RecordSubscribeRequest,
  type RecordUnsubscribeRequest,
  type RecordUpdateRequest,
} from "../protocol/messages.js";
import { ProtocolError, parsePluginToHostMessage } from "../protocol/parse.js";
import { isSandboxControlKind } from "../protocol/sandbox-messages.js";

export interface HostRecordSelector {
  readonly incidentId: string | null;
  readonly tableId: string;
  readonly recordId: string;
  readonly fieldIds: readonly string[] | null;
}

export interface HostBridgeServices {
  /** Read through authorized API services with plugin, user, tenant, incident, RLS, and FLS scope. */
  getRecord(scope: PluginSecurityScope, selector: HostRecordSelector): Promise<HostRecord | null>;
  /** Patch granted fields with optimistic concurrency and immutable plugin/user/position audit. */
  updateRecord(
    scope: PluginSecurityScope,
    selector: HostRecordSelector,
    values: Readonly<Record<string, unknown>>,
    expectedVersion: number,
  ): Promise<HostRecord>;
  /** Create an authorized record subscription and return its host ID plus cleanup callback. */
  subscribe(
    scope: PluginSecurityScope,
    selector: Omit<HostRecordSelector, "recordId" | "fieldIds"> & {
      readonly viewId: string | null;
    },
    emit: (record: HostRecord, cursor: string) => Promise<void>,
  ): Promise<{ readonly subscriptionId: string; readonly close: () => Promise<void> }>;
}

export interface HostBridgeOptions {
  readonly manifest: PluginManifest;
  readonly scope: PluginSecurityScope;
  /** Exact origin of the plugin window. A sandboxed iframe without allow-same-origin is "null". */
  readonly expectedPluginOrigin: string;
  readonly pluginWindow: Window;
  readonly hostWindow: Window;
  readonly services: HostBridgeServices;
  readonly maximumMessageBytes: number;
  /** Host-chosen session id; generated when omitted. Exposed as `HostBridge.sessionId`. */
  readonly sessionId?: string;
  /** Handshake nonce; generated when omitted. Exposed as `HostBridge.handshakeNonce`. */
  readonly handshakeNonce?: string;
  /** Requests allowed per window; excess requests get `rate-limited`. Default 200 per 10 s. */
  readonly rateLimit?: { readonly maxRequests: number; readonly windowMs: number };
  readonly maxSubscriptions?: number;
  /** Injectable clock (tests). */
  readonly now?: () => number;
}

export interface HostBridge {
  readonly sessionId: string;
  readonly handshakeNonce: string;
  /** Start the nonce handshake; resolves only after manifest/session/capability agreement. */
  start(): Promise<void>;
  /** Handle one exact-origin/source MessageEvent and enforce per-request capabilities and rate limits. */
  handleMessage(event: MessageEvent<unknown>): Promise<void>;
  /** Revoke grants, close subscriptions, reject requests, and detach listeners exactly once. */
  dispose(reason: "navigation" | "logout" | "revoked" | "error"): Promise<void>;
}

const MAX_SEEN_MESSAGE_IDS = 10_000;

const SAFE_MESSAGES: Record<HostErrorMessage["code"], string> = {
  "invalid-message": "The request was malformed.",
  "capability-denied": "Capability denied.",
  "not-found": "Not found.",
  "version-conflict": "The record changed; reload and retry.",
  "rate-limited": "Too many requests.",
  unavailable: "The service is unavailable.",
  "protocol-ended": "The session has ended.",
};

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

/** Map any thrown value to a safe error code. Error text from services is never forwarded. */
function classify(error: unknown): HostErrorMessage["code"] {
  if (error instanceof CapabilityDeniedError) return "capability-denied";
  if (error instanceof ProtocolError) return "invalid-message";
  const code = (error as { code?: unknown } | null)?.code;
  if (
    code === "capability-denied" ||
    code === "not-found" ||
    code === "version-conflict" ||
    code === "rate-limited"
  ) {
    return code;
  }
  return "unavailable";
}

function wildcardTarget(origin: string): string {
  // postMessage cannot target the opaque origin "null"; "*" is the only option. Safety then relies on
  // the exact Window reference plus tearing the bridge down if the frame ever navigates (see
  // SandboxFrame) and on only ever sending data in response to validated, capability-checked requests.
  return origin === "null" ? "*" : origin;
}

/**
 * Create the privileged host bridge for one sandboxed iframe.
 * Owns the nonce handshake, request correlation, capability + field redaction, subscriptions,
 * rate limiting, revocation and teardown. Iframe isolation is not authorization: every request is
 * re-checked against the host-derived `scope`; plugin claims are never trusted.
 *
 * Deviation from the stub doc: messages from a different origin/source window are ignored silently
 * (they are not our plugin, and closing would let any window kill the bridge). Session, identity,
 * replay and pre-handshake violations from the real plugin window close the bridge.
 */
export function createHostBridge(options: HostBridgeOptions): HostBridge {
  const sessionId = options.sessionId ?? randomId();
  const handshakeNonce = options.handshakeNonce ?? randomId();
  const now = options.now ?? Date.now;
  const limit = options.rateLimit ?? { maxRequests: 200, windowMs: 10_000 };
  const maxSubscriptions = options.maxSubscriptions ?? 20;
  const { scope, manifest, services } = options;

  let handshaken = false;
  let disposed = false;
  let started = false;
  let resolveStart: (() => void) | null = null;
  let rejectStart: ((error: Error) => void) | null = null;
  let windowStart = now();
  let windowCount = 0;
  const seenIds = new Set<string>();
  const subscriptions = new Map<string, () => Promise<void>>();
  let pendingSubscriptions = 0;

  const send = (message: HostToPluginMessage): void => {
    if (disposed && message.kind !== "host.error") return;
    try {
      options.pluginWindow.postMessage(message, wildcardTarget(options.expectedPluginOrigin));
    } catch {
      // The window may already be gone; nothing to deliver to.
    }
  };

  const envelope = (correlationId: string | null) => ({
    protocolVersion: PLUGIN_PROTOCOL_VERSION,
    pluginId: manifest.id,
    installationId: scope.installationId,
    sessionId,
    messageId: randomId(),
    correlationId,
    sentAt: new Date(now()).toISOString(),
  });

  const sendError = (code: HostErrorMessage["code"], correlationId: string | null): void => {
    send({
      ...envelope(correlationId),
      kind: "host.error",
      code,
      safeMessage: SAFE_MESSAGES[code],
    });
  };

  const readableFields = (tableId: string, incidentId: string | null): readonly string[] | null =>
    grantedFieldIds(scope, "record:read", { tableId, ...(incidentId ? { incidentId } : {}) });

  const redactRecord = (record: HostRecord): HostRecord => ({
    ...record,
    values: redactValues(record.values, readableFields(record.tableId, record.incidentId)),
  });

  const resourceOf = (tableId: string, incidentId: string | null) => ({
    tableId,
    ...(incidentId === null ? {} : { incidentId }),
  });

  /** Capability must be granted for the table/incident with at least one field; returns its fields. */
  const requireTableAccess = (
    capability: PluginCapability,
    resource: { readonly tableId: string; readonly incidentId?: string },
  ): readonly string[] | null => {
    const granted = grantedFieldIds(scope, capability, resource);
    if (granted === null) {
      requirePluginCapability(scope, capability, resource);
      return null;
    }
    const first = granted[0];
    if (first === undefined) throw new CapabilityDeniedError();
    requirePluginCapability(scope, capability, { ...resource, fieldId: first });
    return granted;
  };
  const requireReadAccess = (resource: {
    readonly tableId: string;
    readonly incidentId?: string;
  }) => requireTableAccess("record:read", resource);

  const grantedLabels = (): PluginCapability[] => [
    ...new Set(
      scope.grants
        .filter((g) => !(g.tableIds !== null && g.tableIds.length === 0))
        .map((g) => g.capability),
    ),
  ];

  const handleHello = (message: PluginHelloMessage): void => {
    if (handshaken) throw new ProtocolError("Duplicate hello.");
    if (
      message.handshakeNonce !== handshakeNonce ||
      !message.supportedProtocolVersions.includes(PLUGIN_PROTOCOL_VERSION)
    ) {
      throw new ProtocolError("Handshake rejected.");
    }
    handshaken = true;
    send({
      ...envelope(message.messageId),
      kind: "host.hello",
      handshakeNonce,
      grantedCapabilities: grantedLabels(),
      authorizationRevision: scope.authorizationRevision,
    });
    resolveStart?.();
    resolveStart = null;
    rejectStart = null;
  };

  const handleGet = async (message: RecordGetRequest): Promise<void> => {
    const resource = resourceOf(message.tableId, message.incidentId);
    const granted = requireReadAccess(resource);
    if (message.fieldIds !== null) {
      requirePluginFields(scope, "record:read", resource, message.fieldIds);
    }
    const fieldIds = message.fieldIds ?? granted;
    const record = await services.getRecord(scope, {
      incidentId: message.incidentId,
      tableId: message.tableId,
      recordId: message.recordId,
      fieldIds,
    });
    if (disposed) return;
    send({
      ...envelope(message.messageId),
      kind: "record.result",
      record: record === null ? null : redactRecord(record),
    });
  };

  const handleUpdate = async (message: RecordUpdateRequest): Promise<void> => {
    const resource = resourceOf(message.tableId, message.incidentId);
    const keys = Object.keys(message.values);
    if (keys.length === 0) throw new ProtocolError("Empty update.");
    requirePluginFields(scope, "record:update", resource, keys);
    const record = await services.updateRecord(
      scope,
      {
        incidentId: message.incidentId,
        tableId: message.tableId,
        recordId: message.recordId,
        fieldIds: keys,
      },
      message.values,
      message.expectedVersion,
    );
    if (disposed) return;
    send({ ...envelope(message.messageId), kind: "record.result", record: redactRecord(record) });
  };

  const handleSubscribe = async (message: RecordSubscribeRequest): Promise<void> => {
    const resource = resourceOf(message.tableId, message.incidentId);
    requireTableAccess("record:subscribe", resource);
    // Subscribed data is record data: reading must be granted for the same table/incident.
    const _granted = requireReadAccess(resource);
    if (subscriptions.size + pendingSubscriptions >= maxSubscriptions) {
      sendError("rate-limited", message.messageId);
      return;
    }
    pendingSubscriptions += 1;
    let subscriptionId: string | null = null;
    const queued: Array<{ record: HostRecord; cursor: string }> = [];
    const deliver = (record: HostRecord, cursor: string): void => {
      if (disposed || subscriptionId === null) return;
      send({
        ...envelope(null),
        kind: "record.changed",
        subscriptionId,
        cursor,
        record: redactRecord(record),
      });
    };
    try {
      const handle = await services.subscribe(
        scope,
        { incidentId: message.incidentId, tableId: message.tableId, viewId: message.viewId },
        async (record, cursor) => {
          if (subscriptionId === null) queued.push({ record, cursor });
          else deliver(record, cursor);
        },
      );
      if (disposed) {
        await handle.close();
        return;
      }
      subscriptionId = handle.subscriptionId;
      subscriptions.set(handle.subscriptionId, handle.close);
      send({
        ...envelope(message.messageId),
        kind: "record.subscribed",
        subscriptionId: handle.subscriptionId,
      });
      for (const item of queued.splice(0)) deliver(item.record, item.cursor);
    } finally {
      pendingSubscriptions -= 1;
    }
  };

  const handleUnsubscribe = async (message: RecordUnsubscribeRequest): Promise<void> => {
    const close = subscriptions.get(message.subscriptionId);
    subscriptions.delete(message.subscriptionId);
    if (close) await close();
    // Acknowledge unknown ids identically so ownership of subscription ids is not observable.
    send({ ...envelope(message.messageId), kind: "host.acknowledged" });
  };

  const checkRate = (): boolean => {
    const t = now();
    if (t - windowStart >= limit.windowMs) {
      windowStart = t;
      windowCount = 0;
    }
    windowCount += 1;
    return windowCount <= limit.maxRequests;
  };

  const dispose = async (reason: "navigation" | "logout" | "revoked" | "error"): Promise<void> => {
    if (disposed) return;
    disposed = true;
    options.hostWindow.removeEventListener("message", listener);
    rejectStart?.(new Error(`Bridge disposed: ${reason}.`));
    resolveStart = null;
    rejectStart = null;
    const closers = [...subscriptions.values()];
    subscriptions.clear();
    await Promise.allSettled(closers.map((close) => close()));
    sendError("protocol-ended", null);
  };

  const handleMessage = async (event: MessageEvent<unknown>): Promise<void> => {
    if (disposed) return;
    if (event.origin !== options.expectedPluginOrigin) return;
    if (event.source !== options.pluginWindow) return;
    if (isSandboxControlKind(event.data)) return;

    let message: PluginToHostMessage;
    try {
      message = parsePluginToHostMessage(event.data, options.maximumMessageBytes);
    } catch {
      sendError("invalid-message", null);
      return;
    }

    if (
      message.pluginId !== manifest.id ||
      message.installationId !== scope.installationId ||
      message.sessionId !== sessionId ||
      seenIds.has(message.messageId)
    ) {
      sendError("invalid-message", message.messageId);
      await dispose("error");
      return;
    }
    if (seenIds.size >= MAX_SEEN_MESSAGE_IDS) {
      sendError("rate-limited", message.messageId);
      await dispose("error");
      return;
    }
    seenIds.add(message.messageId);

    if (!checkRate()) {
      sendError("rate-limited", message.messageId);
      return;
    }
    if (message.kind !== "plugin.hello" && !handshaken) {
      sendError("invalid-message", message.messageId);
      await dispose("error");
      return;
    }

    try {
      switch (message.kind) {
        case "plugin.hello":
          handleHello(message);
          break;
        case "record.get":
          await handleGet(message);
          break;
        case "record.update":
          await handleUpdate(message);
          break;
        case "record.subscribe":
          await handleSubscribe(message);
          break;
        case "record.unsubscribe":
          await handleUnsubscribe(message);
          break;
        case "plugin.dispose": {
          const m: PluginDisposeMessage = message;
          await dispose(m.reason === "logout" ? "logout" : "navigation");
          break;
        }
      }
    } catch (error: unknown) {
      sendError(classify(error), message.messageId);
      if (message.kind === "plugin.hello") await dispose("error");
    }
  };

  const listener = (event: Event): void => {
    void handleMessage(event as MessageEvent<unknown>);
  };

  return {
    sessionId,
    handshakeNonce,
    start(): Promise<void> {
      if (disposed) return Promise.reject(new Error("Bridge disposed."));
      if (started) return Promise.reject(new Error("Bridge already started."));
      started = true;
      options.hostWindow.addEventListener("message", listener);
      return new Promise<void>((resolve, reject) => {
        resolveStart = resolve;
        rejectStart = reject;
      });
    },
    handleMessage,
    dispose,
  };
}
