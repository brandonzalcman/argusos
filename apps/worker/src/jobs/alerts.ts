import type { AlertChannel } from "@argus/alerts";
import type { JobHandler, JobPayloadBase } from "./context.js";

export interface AlertDeliveryJobPayload extends JobPayloadBase {
  readonly alertId: string;
  readonly deliveryId: string;
  readonly channel: AlertChannel;
  readonly recipientId: string;
}

export interface AlertEscalationJobPayload extends JobPayloadBase {
  readonly alertId: string;
  readonly escalationPolicyVersionId: string;
  readonly escalationLevel: number;
  readonly evaluateAt: string;
}

export interface AlertAcknowledgementJobPayload extends JobPayloadBase {
  readonly acknowledgementId: string;
  readonly alertId: string;
  readonly deliveryId: string;
  readonly acknowledgedByUserId: string;
  readonly acknowledgedAt: string;
  readonly evidenceReference: string;
}

export interface AlertAcknowledgementExpiryJobPayload extends JobPayloadBase {
  readonly alertId: string;
  readonly deliveryId: string;
  readonly dueAt: string;
}

/**
 * TODO(implementation): deliver one alert through the selected adapter and persist the attempt atomically.
 * Input: AlertDeliveryJobPayload with stable alert/delivery/idempotency identity.
 * Output: accepted completion, scheduled retry, or dead-letter according to the adapter outcome.
 * Errors: provider retries are bounded; duplicate jobs cannot duplicate durable/provider effects.
 * Depends on: @argus/alerts registry, recipient policy, delivery repository, and audit/outbox storage.
 * Security: fetches destinations server-side, applies tenant/incident policy, and redacts content/secrets.
 */
export const deliverAlert: JobHandler<AlertDeliveryJobPayload> = (_context) => {
  throw new Error("TODO(implementation): deliverAlert");
};

/**
 * TODO(implementation): evaluate unacknowledged alerts and enqueue the next authorized escalation level.
 * Input: AlertEscalationJobPayload with immutable escalation policy version and evaluation time.
 * Output: completed/waiting result plus idempotently scheduled deliveries when escalation is still due.
 * Errors: retries transient reads; stale policy/deadline jobs do not escalate resolved alerts.
 * Depends on: acknowledgement repository, contact groups, alert adapter registry, and audit.
 * Security: escalation cannot add recipients outside tenant, incident, jurisdiction, or field policy.
 */
export const escalateAlert: JobHandler<AlertEscalationJobPayload> = (_context) => {
  throw new Error("TODO(implementation): escalateAlert");
};

/**
 * TODO(implementation): persist one authenticated alert acknowledgement and stop pending escalations.
 * Input: AlertAcknowledgementJobPayload with stable acknowledgement ID and server-issued evidence reference.
 * Output: completed duplicate/accepted result with delivery state and cancellation of future escalation effects.
 * Errors: rejects invalid evidence or recipient mismatch; transient state writes retry idempotently.
 * Depends on: API/provider evidence verification, acknowledgement repository, escalation scheduler, and audit.
 * Security: verifies the authenticated user/recipient, tenant, incident, and delivery before attributing acknowledgement.
 */
export const acknowledgeAlert: JobHandler<AlertAcknowledgementJobPayload> = (_context) => {
  throw new Error("TODO(implementation): acknowledgeAlert");
};

/**
 * TODO(implementation): mark an unacknowledged delivery overdue at its deadline.
 * Input: AlertAcknowledgementExpiryJobPayload identifying one delivery and due time.
 * Output: completed result with overdue audit state or waiting when acknowledgement already exists.
 * Errors: retries repository failures and ignores stale expiry after a valid acknowledgement.
 * Depends on: acknowledgement optimistic versions, alert repository, escalation scheduler, and audit.
 * Security: acknowledgements are authenticated separately; expiry never fabricates user acknowledgement.
 */
export const expireAlertAcknowledgement: JobHandler<AlertAcknowledgementExpiryJobPayload> = (
  _context,
) => {
  throw new Error("TODO(implementation): expireAlertAcknowledgement");
};
