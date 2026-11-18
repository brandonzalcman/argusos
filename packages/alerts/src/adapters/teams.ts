import type { AlertChannelAdapter } from "../adapter.js";
import type { SecretReference } from "../types.js";

export interface TeamsAdapterConfig {
  readonly connector: "workflow-webhook" | "bot";
  readonly credentialsSecretRef: SecretReference;
  readonly allowedTenantIds: readonly string[];
  readonly timeoutMs: number;
}

/**
 * TODO(implementation): create a Microsoft Teams channel adapter using approved cards/messages.
 * Input: connector kind, credentials reference, allowed Microsoft tenant IDs, and timeout.
 * Output: a teams AlertChannelAdapter with redacted delivery outcomes.
 * Errors: throws configuration errors and classifies rate limits, auth failures, and rejected messages.
 * Depends on: Teams workflow/bot API, egress policy, and worker idempotency/audit storage.
 * Security: restrict connector destinations, redact URLs/tokens, and do not post sensitive fields by default.
 */
export function createTeamsAdapter(_config: TeamsAdapterConfig): AlertChannelAdapter<"teams"> {
  throw new Error("TODO(implementation): createTeamsAdapter");
}
