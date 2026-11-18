import type { AlertChannelAdapter } from "../adapter.js";
import type { SecretReference } from "../types.js";

export interface SlackAdapterConfig {
  readonly connector: "bot" | "incoming-webhook";
  readonly credentialsSecretRef: SecretReference;
  readonly defaultChannelId: string | null;
  readonly timeoutMs: number;
}

/**
 * TODO(implementation): create a Slack adapter using approved blocks and scoped destinations.
 * Input: bot/webhook choice, credentials reference, optional channel, and bounded timeout.
 * Output: a slack AlertChannelAdapter with stable provider outcome classification.
 * Errors: throws redacted configuration errors and maps Slack rate/auth/message errors.
 * Depends on: Slack Web API or signed webhook client, egress policy, and idempotency storage.
 * Security: restrict channels, redact webhook URLs/tokens, and exclude sensitive field content by default.
 */
export function createSlackAdapter(_config: SlackAdapterConfig): AlertChannelAdapter<"slack"> {
  throw new Error("TODO(implementation): createSlackAdapter");
}
