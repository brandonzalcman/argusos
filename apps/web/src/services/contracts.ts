/** Required tenant/incident boundary for every app service operation. */
export interface AppScope {
  readonly tenantId: string;
  /** Null only for explicitly global metadata or reference data, never incident records. */
  readonly incidentId: string | null;
}

export interface ActorContext {
  readonly userId: string;
  readonly positionId: string;
  readonly sessionId: string;
}

export interface AuditMetadata {
  readonly correlationId: string;
  readonly actor: ActorContext;
  readonly scope: AppScope;
}

export type Unsubscribe = () => void;
