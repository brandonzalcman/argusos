export const REALTIME_PROTOCOL_VERSION = "1.0" as const;

export type RealtimeStream = "incident-events" | "alerts" | "presence";

export interface AuthenticateMessage {
  readonly type: "authenticate";
  readonly protocolVersion: typeof REALTIME_PROTOCOL_VERSION;
  readonly credential: string | null;
  readonly connectionNonce: string;
}

export interface SubscribeMessage {
  readonly type: "subscribe";
  readonly requestId: string;
  readonly stream: RealtimeStream;
  readonly incidentId: string;
  readonly afterCursor: string | null;
}

export interface UnsubscribeMessage {
  readonly type: "unsubscribe";
  readonly requestId: string;
  readonly subscriptionId: string;
}

export interface PresenceHeartbeatMessage {
  readonly type: "presence.heartbeat";
  readonly incidentId: string;
  readonly boardId: string | null;
  readonly recordId: string | null;
}

export interface EditingLockMessage {
  readonly type: "editing-lock.acquire" | "editing-lock.release";
  readonly requestId: string;
  readonly incidentId: string;
  readonly tableId: string;
  readonly recordId: string;
  readonly fieldId: string | null;
}

export interface AlertAcknowledgeMessage {
  readonly type: "alert.acknowledge";
  readonly requestId: string;
  readonly incidentId: string;
  readonly alertId: string;
  readonly deliveryId: string;
}

export interface PingMessage {
  readonly type: "ping";
  readonly nonce: string;
}

export type ClientMessage =
  | AuthenticateMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PresenceHeartbeatMessage
  | EditingLockMessage
  | AlertAcknowledgeMessage
  | PingMessage;

export interface ServerEventMessage {
  readonly type: "event";
  readonly subscriptionId: string;
  readonly eventId: string;
  readonly cursor: string;
  readonly tenantId: string;
  readonly incidentId: string | null;
  readonly committedAt: Date | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ServerStatusMessage {
  readonly type: "authenticated" | "subscribed" | "unsubscribed" | "pong" | "backfill-complete";
  readonly requestId: string | null;
  readonly subscriptionId: string | null;
  readonly nonce: string | null;
  readonly serverTime: Date;
}

export interface ServerErrorMessage {
  readonly type: "error";
  readonly requestId: string | null;
  readonly code:
    | "unauthenticated"
    | "forbidden"
    | "invalid-message"
    | "rate-limited"
    | "cursor-expired"
    | "internal";
  readonly safeMessage: string;
  readonly closeAfterSend: boolean;
}

export type ServerMessage = ServerEventMessage | ServerStatusMessage | ServerErrorMessage;

/**
 * TODO(implementation): strictly decode and validate one versioned client frame.
 * Input: an unknown JSON value within the configured byte/rate limits.
 * Output: a discriminated ClientMessage with canonical bounded strings and cursor values.
 * Errors: throws a safe protocol error; authentication failures close without reflecting credentials.
 * Depends on: Zod schemas and connection authentication/authorization middleware.
 * Security: message tenant/incident claims are requests only and never replace verified connection scope.
 */
export function parseClientMessage(_input: unknown): ClientMessage {
  throw new Error("TODO(implementation): parseClientMessage");
}

/**
 * TODO(implementation): encode an authorized server message with transport-safe dates.
 * Input: a ServerMessage whose payload has already passed tenant, incident, RLS, and FLS filtering.
 * Output: a bounded UTF-8 JSON frame ready for one authenticated socket.
 * Errors: throws for oversized, malformed, or unserializable messages rather than sending partial data.
 * Depends on: protocol serializers and outbound payload authorization.
 * Security: strips undefined/internal fields and never serializes tokens or sensitive internal metadata.
 */
export function encodeServerMessage(_message: ServerMessage): string {
  throw new Error("TODO(implementation): encodeServerMessage");
}
