export interface RealtimeConfig {
  readonly environment: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  readonly publicOrigin: string;
  readonly natsUrls: readonly string[];
  readonly natsCredentialsSecretRef: string;
  readonly apiInternalOrigin: string;
  readonly heartbeatIntervalMs: number;
  readonly connectionTimeoutMs: number;
  readonly maximumMessageBytes: number;
  readonly pollingFallbackIntervalMs: 5000;
  readonly trustedProxyHops: number;
}

/**
 * TODO(implementation): validate realtime gateway environment without logging credentials.
 * Input: raw process or test environment values.
 * Output: immutable listener, NATS, authentication, heartbeat, and recovery configuration.
 * Errors: throws a redacted error listing missing or invalid settings.
 * Depends on: Zod, deployment secret references, API authentication introspection, and NATS policy.
 * Security: production requires secure origins, explicit proxy trust, scoped NATS credentials, and limits.
 */
export function parseRealtimeEnvironment(
  _environment: Readonly<Record<string, string | undefined>>,
): RealtimeConfig {
  throw new Error("TODO(implementation): parseRealtimeEnvironment");
}
