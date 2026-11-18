import type { ConnectionAuthContext } from "../auth/context.js";

export interface EventEnvelope {
  readonly eventId: string;
  readonly cursor: string;
  readonly tenantId: string;
  readonly incidentId: string | null;
  readonly kind: string;
  readonly committedAt: Date | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface EventSubscription {
  readonly subject: string;
  /** Stop delivery and release resources; repeated calls are idempotent and never throw on cleanup. */
  close(): Promise<void>;
}

export interface ScopedEventBus {
  /**
   * Subscribe to one canonical scoped subject with an optional durable replay cursor.
   * Input: verified connection context, concrete subject, cursor, and bounded async event handler.
   * Output: a closable subscription whose handler receives only transport envelopes.
   * Errors: throws for wildcard/cross-scope subjects, expired cursors, or unavailable JetStream.
   * Depends on: scoped NATS credentials, JetStream consumers, and subject authorization.
   * Security: handlers must authorize/filter each payload again before sending it to a connection.
   */
  subscribe(
    context: ConnectionAuthContext,
    subject: string,
    afterCursor: string | null,
    onEvent: (event: EventEnvelope) => Promise<void>,
  ): Promise<EventSubscription>;
}

/**
 * TODO(implementation): create a NATS JetStream event-bus port for authenticated subscriptions.
 * Input: NATS URLs and a deployment secret reference for scoped service credentials.
 * Output: a ScopedEventBus with bounded pending messages and explicit cleanup.
 * Errors: throws redacted connection/configuration errors during composition.
 * Depends on: NATS JetStream, canonical subjects, backpressure policy, and telemetry.
 * Security: uses no global superuser subject and never trusts event tenant IDs without scope checks.
 */
export function createNatsEventBus(
  _urls: readonly string[],
  _credentialsSecretRef: string,
): ScopedEventBus {
  throw new Error("TODO(implementation): createNatsEventBus");
}
