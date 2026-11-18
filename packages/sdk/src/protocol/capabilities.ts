import type { PluginCapability as ComponentCapability } from "@argus/schema";

export type PluginCapability =
  | "record:read"
  | "record:update"
  | "record:subscribe"
  | "view:read"
  | "file:read"
  | "file:write"
  | "alert:read"
  | "alert:send"
  | "workflow:run"
  | "feed:ingest"
  | "network:egress";

export interface CapabilityGrant {
  readonly capability: PluginCapability;
  readonly tableIds: readonly string[] | null;
  readonly fieldIds: readonly string[] | null;
  readonly incidentIds: readonly string[] | null;
  readonly destinations: readonly string[] | null;
}

export interface PluginSecurityScope {
  readonly tenantId: string;
  readonly installationId: string;
  readonly actorUserId: string | null;
  readonly actorPositionId: string | null;
  readonly grants: readonly CapabilityGrant[];
  readonly authorizationRevision: number;
  readonly expiresAt: Date | null;
}

export interface PluginManifest {
  readonly id: string;
  readonly version: string;
  readonly apiVersion: "1.0";
  readonly displayName: string;
  readonly iframeEntry: string | null;
  readonly serverEntry: string | null;
  readonly requestedCapabilities: readonly PluginCapability[];
  readonly requestedEgressOrigins: readonly string[];
}

/** Redacted denial; never reveals whether the resource exists or which dimension failed. */
export class CapabilityDeniedError extends Error {
  readonly code = "capability-denied" as const;
  readonly safeMessage = "Capability denied.";
  constructor() {
    super("Capability denied.");
    this.name = "CapabilityDeniedError";
  }
}

export interface CapabilityResource {
  readonly tableId?: string;
  readonly fieldId?: string;
  readonly incidentId?: string;
  readonly destination?: string;
}

/**
 * Validate a requested capability against an administrator-granted scope.
 * Input: immutable plugin scope, required capability, and optional table/field/incident/destination.
 * Output: the first narrowed grant for which every supplied dimension is allowed.
 * Errors: throws a redacted CapabilityDeniedError for absent, expired, or overbroad grants.
 * Security: a `null` dimension is an explicit wildcard; an empty array grants nothing. A dimension
 * that the grant restricts but the request omits is denied (no implicit widening).
 * TODO(verify): authorization-revision and incident-membership re-checks belong to the API services.
 */
export function requirePluginCapability(
  scope: PluginSecurityScope,
  capability: PluginCapability,
  resource: CapabilityResource = {},
  now: Date = new Date(),
): CapabilityGrant {
  if (scope.expiresAt !== null && scope.expiresAt.getTime() <= now.getTime()) {
    throw new CapabilityDeniedError();
  }
  const allows = (list: readonly string[] | null, value: string | undefined): boolean =>
    list === null || (value !== undefined && list.includes(value));
  for (const grant of scope.grants) {
    if (grant.capability !== capability) continue;
    if (
      allows(grant.tableIds, resource.tableId) &&
      allows(grant.fieldIds, resource.fieldId) &&
      allows(grant.incidentIds, resource.incidentId) &&
      allows(grant.destinations, resource.destination)
    ) {
      return grant;
    }
  }
  throw new CapabilityDeniedError();
}

/** Every field must be granted for the table; returns normally or throws CapabilityDeniedError. */
export function requirePluginFields(
  scope: PluginSecurityScope,
  capability: PluginCapability,
  resource: Omit<CapabilityResource, "fieldId">,
  fieldIds: readonly string[],
): void {
  requirePluginCapability(scope, capability, resource);
  for (const fieldId of fieldIds) {
    requirePluginCapability(scope, capability, { ...resource, fieldId });
  }
}

/** Field ids a scope may see for a table, or null when unrestricted. Empty array means none. */
export function grantedFieldIds(
  scope: PluginSecurityScope,
  capability: PluginCapability,
  resource: Omit<CapabilityResource, "fieldId">,
): readonly string[] | null {
  const allowed = new Set<string>();
  for (const grant of scope.grants) {
    if (grant.capability !== capability) continue;
    if (grant.tableIds !== null && !(resource.tableId && grant.tableIds.includes(resource.tableId)))
      continue;
    if (
      grant.incidentIds !== null &&
      !(resource.incidentId && grant.incidentIds.includes(resource.incidentId))
    )
      continue;
    if (grant.fieldIds === null) return null;
    for (const f of grant.fieldIds) allowed.add(f);
  }
  return [...allowed];
}

/** Host-side redaction: drop every value whose field is not granted. */
export function redactValues(
  values: Readonly<Record<string, unknown>>,
  allowedFieldIds: readonly string[] | null,
): Record<string, unknown> {
  if (allowedFieldIds === null) return { ...values };
  const allowed = new Set(allowedFieldIds);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key)) out[key] = value;
  }
  return out;
}

const COMPONENT_CAPABILITY_MAP = {
  "read-records": "record:read",
  "update-records": "record:update",
  "subscribe-records": "record:subscribe",
} as const;

/**
 * Convert a custom component's declared capabilities (schema shape) into bridge grants.
 * Only record capabilities are bridged; `outbound-http` and `workflow-action` are ignored because
 * the sandbox has no network and no workflow bridge. Empty id lists grant nothing.
 * TODO(decision): whether an empty `tableIds` should mean "any table the placing user selects".
 */
export function grantsFromComponentCapabilities(
  capabilities: readonly ComponentCapability[],
): CapabilityGrant[] {
  const grants: CapabilityGrant[] = [];
  for (const cap of capabilities) {
    if (cap.type === "read-records" || cap.type === "update-records" || cap.type === "subscribe-records") {
      grants.push({
        capability: COMPONENT_CAPABILITY_MAP[cap.type],
        tableIds: [...cap.tableIds],
        fieldIds: [...cap.fieldIds],
        incidentIds: null,
        destinations: null,
      });
    }
  }
  return grants;
}
