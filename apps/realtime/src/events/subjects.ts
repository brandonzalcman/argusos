export type NatsSubjectKind = "incident-events" | "alerts" | "presence" | "workflows" | "feeds";

export interface NatsSubjectScope {
  readonly tenantId: string;
  readonly incidentId: string | null;
}

/**
 * TODO(implementation): build a canonical NATS subject from server-verified scope.
 * Input: tenant/incident IDs already canonicalized by the server and one known subject kind.
 * Output: a per-tenant, per-incident subject safe for scoped NATS credentials.
 * Errors: throws for separators, wildcards, empty identifiers, or unsupported subject kinds.
 * Depends on: platform ID encoding and deployment NATS account/credential policy.
 * Security: never interpolates raw user strings and prevents wildcard or cross-tenant subscription escape.
 */
export function buildNatsSubject(_scope: NatsSubjectScope, _kind: NatsSubjectKind): string {
  throw new Error("TODO(implementation): buildNatsSubject");
}

/**
 * TODO(implementation): verify that a concrete subject belongs to exactly the authorized scope.
 * Input: a candidate concrete subject and the connection's verified tenant/incident scope.
 * Output: true only for a canonical matching subject; false for wildcards or any scope mismatch.
 * Errors: throws for malformed candidate input that cannot be compared safely.
 * Depends on: buildNatsSubject's canonical ID encoding and NATS subject grammar.
 * Security: this check supplements, but never replaces, scoped NATS credentials and payload FLS.
 */
export function isSubjectInScope(_subject: string, _scope: NatsSubjectScope): boolean {
  throw new Error("TODO(implementation): isSubjectInScope");
}
