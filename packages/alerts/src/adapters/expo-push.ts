import type { AlertChannelAdapter } from "../adapter.js";
import type { SecretReference } from "../types.js";

export interface ExpoPushAdapterConfig {
  readonly accessTokenSecretRef: SecretReference | null;
  readonly apiOrigin: string;
  readonly timeoutMs: number;
  readonly maximumBatchSize: number;
}

/**
 * TODO(implementation): create an Expo push adapter with token validation and receipt classification.
 * Input: Expo API origin, optional access-token reference, batch limit, and timeout.
 * Output: an expo-push AlertChannelAdapter; recipients use scoped Expo push tokens as destinations.
 * Errors: throws redacted setup errors and maps token/receipt failures to stable outcomes.
 * Depends on: Expo push API, receipt polling orchestration, and worker idempotency/audit storage.
 * Security: never log push tokens or alert bodies and revoke disabled device tokens promptly.
 */
export function createExpoPushAdapter(
  _config: ExpoPushAdapterConfig,
): AlertChannelAdapter<"expo-push"> {
  throw new Error("TODO(implementation): createExpoPushAdapter");
}
