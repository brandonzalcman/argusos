import type { AlertChannelAdapter } from "../adapter.js";
import type { SecretReference } from "../types.js";

export interface SmtpEmailAdapterConfig {
  readonly host: string;
  readonly port: number;
  readonly security: "starttls" | "tls";
  readonly username: string;
  readonly passwordSecretRef: SecretReference;
  readonly fromAddress: string;
  readonly fromName: string;
  readonly timeoutMs: number;
}

/**
 * TODO(implementation): create an SMTP email adapter with TLS, bounded delivery, and idempotency.
 * Input: validated SMTP endpoint/from settings and a password secret reference.
 * Output: an email AlertChannelAdapter with no credentials exposed in its public state.
 * Errors: throws redacted setup errors for invalid TLS, sender, timeout, or secret configuration.
 * Depends on: an SMTP client, deployment secret resolver, and worker idempotency/audit storage.
 * Security: prevent header injection, log only redacted recipients, and require authenticated TLS policy.
 */
export function createSmtpEmailAdapter(
  _config: SmtpEmailAdapterConfig,
): AlertChannelAdapter<"email"> {
  throw new Error("TODO(implementation): createSmtpEmailAdapter");
}
