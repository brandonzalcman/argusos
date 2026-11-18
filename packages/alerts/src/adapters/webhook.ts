import type { AlertChannelAdapter } from "../adapter.js";
import type { SecretReference } from "../types.js";

export interface WebhookAlertAdapterConfig {
  readonly signingSecretRef: SecretReference;
  readonly allowedDestinations: readonly string[];
  readonly timeoutMs: number;
  readonly maximumResponseBytes: number;
}

/**
 * TODO(implementation): create a signed generic-webhook alert adapter with egress protections.
 * Input: signing key reference, exact destination allowlist, response limit, and timeout.
 * Output: a webhook AlertChannelAdapter that emits timestamped signed requests.
 * Errors: throws for unsafe destinations and classifies response, timeout, and rate-limit failures.
 * Depends on: an SSRF-resistant HTTP client, DNS/IP revalidation, secret resolver, and audit storage.
 * Security: blocks local/link-local networks and redirects unless explicitly allowed; redacts URLs/secrets.
 */
export function createWebhookAlertAdapter(
  _config: WebhookAlertAdapterConfig,
): AlertChannelAdapter<"webhook"> {
  throw new Error("TODO(implementation): createWebhookAlertAdapter");
}
