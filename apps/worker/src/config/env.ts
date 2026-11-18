export interface WorkerConfig {
  readonly environment: "development" | "test" | "production";
  readonly databaseUrlSecretRef: string;
  readonly concurrency: number;
  readonly pollIntervalMs: number;
  readonly maximumAttempts: number;
  readonly schemaName: string;
  readonly natsUrls: readonly string[];
  readonly natsCredentialsSecretRef: string;
  readonly s3Endpoint: string;
  readonly s3Bucket: string;
  readonly s3CredentialsSecretRef: string;
  readonly webhookEgressAllowlist: readonly string[];
  readonly auditRetentionDays: number;
}

/**
 * TODO(implementation): validate worker environment without resolving or logging secret values.
 * Input: raw process or test environment values.
 * Output: immutable Graphile, NATS, object-storage, egress, and retention configuration.
 * Errors: throws a redacted configuration error for missing, conflicting, or unsafe settings.
 * Depends on: Zod, deployment secret references, and Graphile Worker schema conventions.
 * Security: production requires least-privilege database/NATS credentials and explicit webhook egress policy.
 */
export function parseWorkerEnvironment(
  _environment: Readonly<Record<string, string | undefined>>,
): WorkerConfig {
  throw new Error("TODO(implementation): parseWorkerEnvironment");
}
