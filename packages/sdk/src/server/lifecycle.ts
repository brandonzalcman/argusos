export type ServerPluginLifecycleState =
  | "installed"
  | "activating"
  | "active"
  | "suspended"
  | "deactivating"
  | "stopped"
  | "failed";

export interface PluginLifecycleEvent {
  readonly installationId: string;
  readonly tenantId: string;
  readonly from: ServerPluginLifecycleState;
  readonly to: ServerPluginLifecycleState;
  readonly reason: string;
  readonly occurredAt: Date;
  readonly authorizationRevision: number;
}

export interface PluginLifecycleHooks {
  /** Stop accepting work, flush bounded audit telemetry, and release all resources exactly once. */
  deactivate(signal: AbortSignal): Promise<void>;
  /** Suspend on revocation/token expiry without retaining usable credentials or subscriptions. */
  suspend(reason: string): Promise<void>;
  /** Resume only after a fresh grant/token check; stale authorization revisions cannot reactivate work. */
  resume(authorizationRevision: number, signal: AbortSignal): Promise<void>;
}

/**
 * TODO(implementation): enforce valid server-plugin lifecycle transitions and resource cleanup.
 * Input: current lifecycle state, target state, reason, and current authorization revision.
 * Output: a validated PluginLifecycleEvent for durable installation state and audit.
 * Errors: throws for invalid/stale transitions or revocation races and triggers safe cleanup.
 * Depends on: plugin installation repository, worker supervisor, and scoped token revocation.
 * Security: revocation always wins over activation/resume and destroys ambient credentials immediately.
 */
export function transitionPluginLifecycle(
  _from: ServerPluginLifecycleState,
  _to: ServerPluginLifecycleState,
  _installationId: string,
  _tenantId: string,
  _reason: string,
  _authorizationRevision: number,
): PluginLifecycleEvent {
  throw new Error("TODO(implementation): transitionPluginLifecycle");
}
