import type { AlertChannelAdapter } from "../adapter.js";
import type { SecretReference } from "../types.js";

export interface SmsAdapterConfig {
  readonly provider: "twilio" | "vonage" | "local-carrier";
  readonly fromNumber: string;
  readonly credentialsSecretRef: SecretReference;
  readonly providerRegion: string | null;
  readonly timeoutMs: number;
}

/**
 * TODO(implementation): create a provider-neutral SMS adapter with segmented-message limits.
 * Input: selected provider, sender, region, timeout, and credentials secret reference.
 * Output: an SMS AlertChannelAdapter that classifies delivery outcomes.
 * Errors: throws redacted configuration errors; provider attempts return typed retryable/permanent outcomes.
 * Depends on: the selected provider SDK/HTTP client, secret resolver, and idempotency storage.
 * Security: validate destination policy, redact phone numbers/content, and preserve tenant idempotency.
 */
export function createSmsAdapter(_config: SmsAdapterConfig): AlertChannelAdapter<"sms"> {
  throw new Error("TODO(implementation): createSmsAdapter");
}
