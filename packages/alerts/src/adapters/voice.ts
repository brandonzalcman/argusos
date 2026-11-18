import type { AlertChannelAdapter } from "../adapter.js";
import type { SecretReference } from "../types.js";

export interface VoiceAdapterConfig {
  readonly provider: "twilio" | "vonage" | "local-carrier";
  readonly fromNumber: string;
  readonly credentialsSecretRef: SecretReference;
  readonly acknowledgementCallbackOrigin: string;
  readonly timeoutMs: number;
}

/**
 * TODO(implementation): create a voice-call adapter with safe text-to-speech and acknowledgement hooks.
 * Input: provider/sender settings, public callback origin, timeout, and secret reference.
 * Output: a voice AlertChannelAdapter supporting bounded call attempts and acknowledgement links.
 * Errors: throws redacted setup errors and classifies call provider failures.
 * Depends on: provider call API, approved TTS locale voice, callback signing, and idempotency storage.
 * Security: sanitize spoken text, redact numbers/recordings, and authenticate acknowledgement callbacks.
 */
export function createVoiceAdapter(_config: VoiceAdapterConfig): AlertChannelAdapter<"voice"> {
  throw new Error("TODO(implementation): createVoiceAdapter");
}
