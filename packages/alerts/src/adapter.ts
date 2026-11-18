import type {
  AdapterHealth,
  AlertChannel,
  AlertRecipient,
  DeliveryOutcome,
  DeliveryRequest,
} from "./types.js";

export interface AdapterCapabilities {
  readonly supportsHtml: boolean;
  readonly supportsDeliveryReceipts: boolean;
  readonly supportsAcknowledgementLinks: boolean;
  readonly maximumPlainTextLength: number | null;
}

/** A provider adapter performs one idempotent delivery attempt; orchestration belongs to the worker. */
export interface AlertChannelAdapter<C extends AlertChannel = AlertChannel> {
  readonly channel: C;
  readonly capabilities: AdapterCapabilities;

  /**
   * Validate and normalize a recipient without delivering or logging its sensitive destination.
   * Input: a recipient destination intended for this channel.
   * Output: resolves when valid, with any normalization exposed through a safe typed result later.
   * Errors: throws a redacted validation error for malformed or policy-denied destinations.
   * Depends on: channel-specific validation and tenant destination policy.
   */
  validateRecipient(recipient: AlertRecipient): Promise<void>;

  /**
   * Perform one bounded delivery attempt.
   * Input: a fully scoped request with a stable idempotency key and redacted-safe content.
   * Output: an accepted, retryable, permanent, or suppressed outcome suitable for audit.
   * Errors: throws only for malformed adapter state; provider failures should be classified when possible.
   * Depends on: resolved provider credentials, egress policy, timeout, and idempotency storage.
   * Security: preserves tenant/incident scope and never logs secrets, full destinations, or message bodies.
   */
  deliver(request: DeliveryRequest & { readonly channel: C }): Promise<DeliveryOutcome>;

  /**
   * Check adapter/provider readiness with a bounded timeout and no test delivery.
   * Input: adapter configuration and resolved credentials held by the implementation.
   * Output: redacted health status safe for an administrative health surface.
   * Errors: returns unavailable where possible; throws only for invalid health-check invocation.
   * Depends on: provider health support and deployment egress policy.
   */
  checkHealth(): Promise<AdapterHealth>;
}

export interface AlertAdapterRegistry {
  /** Return the exact registered channel adapter or throw a non-secret configuration error. */
  get<C extends AlertChannel>(channel: C): AlertChannelAdapter<C>;
  /** List registered channels for diagnostics without exposing adapter configuration. */
  channels(): readonly AlertChannel[];
}

/**
 * TODO(implementation): construct a unique channel-to-adapter registry.
 * Input: explicitly configured adapters; no adapter is discovered or enabled implicitly.
 * Output: an immutable registry with typed channel lookup.
 * Errors: throws for duplicate channels, invalid capabilities, or missing mandatory adapters.
 * Depends on: deployment composition and channel-specific adapter factories.
 * Security: enabling a channel is tenant policy, not permission to bypass alert authorization or audit.
 */
export function createAlertAdapterRegistry(
  _adapters: readonly AlertChannelAdapter[],
): AlertAdapterRegistry {
  throw new Error("TODO(implementation): createAlertAdapterRegistry");
}
