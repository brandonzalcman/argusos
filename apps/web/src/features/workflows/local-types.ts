/**
 * Contract types that have no home in @argus/schema yet, deliberately isolated in this one file.
 *
 * TODO(decision): once the API contracts for dry runs, user preferences, account sessions and logo
 * upload are fixed, move these into packages/schema (owned by another thread) as Zod-inferred types
 * and delete this file. Feature code and demo adapters import them via the service modules, which
 * re-export from here, so the move only touches those re-exports.
 */

/** One step's outcome inside a dry run. */
export interface WorkflowDryRunStep {
  readonly stepId: string;
  readonly status: "executed" | "skipped" | "would-wait" | "failed";
  /** Branch the engine would follow after this step, if any. */
  readonly branchTaken: string | null;
  readonly detail: string;
  readonly durationMs: number;
}

/** Result of evaluating a saved workflow version against a sample record without side effects. */
export interface WorkflowDryRunResult {
  readonly outcome: "succeeded" | "failed";
  readonly evaluatedDefinitionVersion: number;
  readonly steps: readonly WorkflowDryRunStep[];
  /** Always true: dry runs never send alerts, call webhooks or write records. */
  readonly sideEffectsSuppressed: true;
}

/** Per-user display preferences. */
export interface UserPreferences {
  readonly version: number;
  readonly density: "compact" | "comfortable";
  /** BCP 47 language tag used for ICU message selection. */
  readonly locale: string;
  readonly rightToLeft: boolean;
  readonly reducedMotion: "system" | "reduce" | "allow";
}

/** One signed-in session of the current user. Never carries tokens or secrets. */
export interface AccountSession {
  readonly id: string;
  readonly deviceLabel: string;
  /** Coarse, human-readable origin such as "Sydney, AU"; null when unknown. */
  readonly locationLabel: string | null;
  readonly createdAt: string;
  readonly lastActiveAt: string;
  readonly current: boolean;
}

/** Result of storing a tenant logo in object storage; the definition only keeps the id. */
export interface LogoUploadResult {
  readonly attachmentId: string;
}
