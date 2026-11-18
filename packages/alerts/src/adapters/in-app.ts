import type { AlertChannelAdapter } from "../adapter.js";
import type { DeliveryOutcome, DeliveryRequest } from "../types.js";

export interface InAppInboxWriter {
  /**
   * Persist one idempotent inbox delivery in the caller's tenant/incident transaction.
   * Input: an authorized delivery request with stable delivery and idempotency IDs.
   * Output: an accepted/suppressed outcome for durable inbox state.
   * Errors: throws scoped persistence errors without exposing another tenant's delivery.
   * Depends on: API database transaction, RLS, alert inbox schema, and immutable audit.
   */
  write(request: DeliveryRequest): Promise<DeliveryOutcome>;
}

/**
 * TODO(implementation): create the in-app adapter over an authorized inbox persistence port.
 * Input: an InAppInboxWriter supplied by the worker composition root.
 * Output: an in-app AlertChannelAdapter that performs no realtime fan-out itself.
 * Errors: throws when the writer is absent or violates the delivery outcome contract.
 * Depends on: transactional inbox storage and a separate authenticated realtime alert fan-out port.
 * Security: writer enforces tenant, incident, recipient, RLS, and audit; content is not trusted HTML.
 */
export function createInAppAdapter(_writer: InAppInboxWriter): AlertChannelAdapter<"in-app"> {
  throw new Error("TODO(implementation): createInAppAdapter");
}
