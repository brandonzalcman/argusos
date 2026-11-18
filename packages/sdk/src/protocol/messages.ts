import type { PluginCapability } from "./capabilities.js";

export const PLUGIN_PROTOCOL_VERSION = "1.0" as const;

export interface PluginMessageEnvelope {
  readonly protocolVersion: typeof PLUGIN_PROTOCOL_VERSION;
  readonly pluginId: string;
  readonly installationId: string;
  readonly sessionId: string;
  readonly messageId: string;
  readonly correlationId: string | null;
  readonly sentAt: string;
}

export interface PluginHelloMessage extends PluginMessageEnvelope {
  readonly kind: "plugin.hello";
  readonly supportedProtocolVersions: readonly string[];
  readonly manifestHash: string;
  readonly handshakeNonce: string;
}

export interface HostHelloMessage extends PluginMessageEnvelope {
  readonly kind: "host.hello";
  readonly handshakeNonce: string;
  readonly grantedCapabilities: readonly PluginCapability[];
  readonly authorizationRevision: number;
}

export interface RecordGetRequest extends PluginMessageEnvelope {
  readonly kind: "record.get";
  readonly incidentId: string | null;
  readonly tableId: string;
  readonly recordId: string;
  readonly fieldIds: readonly string[] | null;
}

export interface RecordUpdateRequest extends PluginMessageEnvelope {
  readonly kind: "record.update";
  readonly incidentId: string | null;
  readonly tableId: string;
  readonly recordId: string;
  readonly expectedVersion: number;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface RecordSubscribeRequest extends PluginMessageEnvelope {
  readonly kind: "record.subscribe";
  readonly incidentId: string | null;
  readonly tableId: string;
  readonly viewId: string | null;
}

export interface RecordUnsubscribeRequest extends PluginMessageEnvelope {
  readonly kind: "record.unsubscribe";
  readonly subscriptionId: string;
}

export interface PluginDisposeMessage extends PluginMessageEnvelope {
  readonly kind: "plugin.dispose";
  readonly reason: "navigation" | "logout" | "host-teardown" | "plugin-shutdown";
}

export type PluginToHostMessage =
  | PluginHelloMessage
  | RecordGetRequest
  | RecordUpdateRequest
  | RecordSubscribeRequest
  | RecordUnsubscribeRequest
  | PluginDisposeMessage;

export interface HostRecord {
  readonly id: string;
  readonly tableId: string;
  readonly incidentId: string | null;
  readonly version: number;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface RecordResultMessage extends PluginMessageEnvelope {
  readonly kind: "record.result";
  readonly record: HostRecord | null;
}

export interface RecordSubscribedMessage extends PluginMessageEnvelope {
  readonly kind: "record.subscribed";
  readonly subscriptionId: string;
}

export interface RecordChangedMessage extends PluginMessageEnvelope {
  readonly kind: "record.changed";
  readonly subscriptionId: string;
  readonly cursor: string;
  readonly record: HostRecord;
}

export interface HostAcknowledgementMessage extends PluginMessageEnvelope {
  readonly kind: "host.acknowledged";
}

export interface HostErrorMessage extends PluginMessageEnvelope {
  readonly kind: "host.error";
  readonly code:
    | "invalid-message"
    | "capability-denied"
    | "not-found"
    | "version-conflict"
    | "rate-limited"
    | "unavailable"
    | "protocol-ended";
  readonly safeMessage: string;
}

export type HostToPluginMessage =
  | HostHelloMessage
  | RecordResultMessage
  | RecordSubscribedMessage
  | RecordChangedMessage
  | HostAcknowledgementMessage
  | HostErrorMessage;

export {
  assertJsonValue,
  DEFAULT_MAX_MESSAGE_BYTES,
  ProtocolError,
  parseHostToPluginMessage,
  parsePluginToHostMessage,
} from "./parse.js";
