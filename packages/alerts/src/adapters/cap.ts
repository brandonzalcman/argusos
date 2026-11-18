import type { AlertChannelAdapter } from "../adapter.js";
import type { DeliveryScope, SecretReference } from "../types.js";

export interface Cap12AlertDocument {
  readonly identifier: string;
  readonly sender: string;
  readonly sent: Date;
  readonly status: "Actual" | "Exercise" | "System" | "Test" | "Draft";
  readonly messageType: "Alert" | "Update" | "Cancel" | "Ack" | "Error";
  readonly scope: "Public" | "Restricted" | "Private";
  readonly category: readonly string[];
  readonly event: string;
  readonly urgency: "Immediate" | "Expected" | "Future" | "Past" | "Unknown";
  readonly severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  readonly certainty: "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";
  readonly headline: string;
  readonly description: string;
  readonly instruction: string | null;
  readonly areaDescriptions: readonly string[];
}

export interface Cap12AdapterConfig {
  readonly senderIdentifier: string;
  readonly signingKeySecretRef: SecretReference | null;
  readonly allowedDestinations: readonly string[];
  readonly timeoutMs: number;
}

/**
 * TODO(implementation): serialize a CAP 1.2 alert using namespace-safe XML construction.
 * Input: a validated Cap12AlertDocument and delivery scope used for exercise/live verification.
 * Output: UTF-8 CAP 1.2 XML bytes with no unescaped interpolation or sensitive debug content.
 * Errors: throws validation errors for missing CAP fields, inconsistent scope, or invalid timestamps.
 * Depends on: an XML builder, CAP 1.2 schema validation, and optional digital-signature policy.
 * Security: exercise incidents must serialize as Exercise; Private/Restricted content requires explicit policy.
 */
export function serializeCap12Alert(
  _document: Cap12AlertDocument,
  _scope: DeliveryScope,
): Uint8Array {
  throw new Error("TODO(implementation): serializeCap12Alert");
}

/**
 * TODO(implementation): create a CAP 1.2 delivery adapter for explicitly allowed standards endpoints.
 * Input: sender identity, optional signing key, destination allowlist, and timeout.
 * Output: a cap-1.2 AlertChannelAdapter using serializeCap12Alert and bounded delivery.
 * Errors: throws redacted setup/validation errors and classifies endpoint delivery outcomes.
 * Depends on: CAP serializer, schema validation, SSRF-resistant transport, and idempotency/audit storage.
 * Security: validates CAP scope and live/exercise semantics and never exposes private alert XML in logs.
 */
export function createCap12Adapter(_config: Cap12AdapterConfig): AlertChannelAdapter<"cap-1.2"> {
  throw new Error("TODO(implementation): createCap12Adapter");
}
