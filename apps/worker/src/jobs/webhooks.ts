import type { JobHandler, JobPayloadBase } from "./context.js";

export interface WebhookDeliveryJobPayload extends JobPayloadBase {
  readonly webhookEndpointId: string;
  readonly webhookDeliveryId: string;
  readonly domainEventId: string;
  readonly payloadObjectId: string;
  readonly signingKeyVersion: number;
}

/**
 * TODO(implementation): sign and deliver one outbound webhook with replay-resistant headers.
 * Input: WebhookDeliveryJobPayload referencing an endpoint, immutable event payload, and key version.
 * Output: accepted completion or bounded retry/dead-letter with redacted response metadata.
 * Errors: classifies timeouts/statuses and never retries permanent policy or signature failures blindly.
 * Depends on: SSRF-resistant HTTP client, endpoint/key repositories, object payload storage, and audit.
 * Security: revalidates allowlist/DNS/IP/redirects and FLS at delivery time; secrets and bodies are redacted.
 */
export const deliverWebhook: JobHandler<WebhookDeliveryJobPayload> = (_context) => {
  throw new Error("TODO(implementation): deliverWebhook");
};
