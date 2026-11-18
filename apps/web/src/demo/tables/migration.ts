import type {
  AuditActor,
  ConversionPreflightResult,
  FieldSnapshot,
  IncidentId,
  IsoDateTime,
  MigrationOperation,
  MigrationPlan,
  MigrationPreview,
  MigrationPreviewWarning,
  MigrationStep,
  PositionId,
  TableId,
  UserId,
} from "@argus/ddl-engine";
import type { FieldDefinition, RecordEnvelope, TableDefinition } from "@argus/schema";
import { DEMO_INCIDENTS, DEMO_POSITIONS, DEMO_TENANT_ID, DEMO_USERS, demoId } from "../scenario.js";

/**
 * Demo-only migration planner. It diffs the draft fields against the in-memory live definition and
 * returns a plausible MigrationPlan. It never executes anything and never emits SQL: `statements` is
 * empty and every step has `statement: null`, so no value can ever be interpolated into SQL.
 */

/** Branded ids are nominal types in the engine; the demo adapter vouches for its own strings. */
const brand = <T extends string>(value: string): T => value as T;

const actor: AuditActor = {
  kind: "user",
  userId: brand<UserId>(DEMO_USERS.alexMorgan),
  positionId: brand<PositionId>(DEMO_POSITIONS.incidentCommander),
  credentialId: null,
};

export function isoNow(): IsoDateTime {
  return brand<IsoDateTime>(new Date().toISOString());
}

function shortId(id: string): string {
  return id.replaceAll("-", "").slice(-8);
}

function snapshotField(field: FieldDefinition): FieldSnapshot {
  return {
    fieldId: brand(field.id),
    key: field.key,
    displayName: field.name,
    columnName: `c_${shortId(field.id)}`,
    type: {
      pluginId: field.type,
      pluginVersion: 1,
      configuration: field.config as Readonly<Record<string, unknown>>,
    },
    storage: "column",
    nullable: !field.required,
    defaultExpression: null,
    formulaExpression: null,
    sensitivity: field.sensitivity === "standard" ? "standard" : "personal",
    hiddenAt: null,
  };
}

export interface DemoPlanRecord {
  readonly plan: MigrationPlan;
  readonly draftFields: readonly FieldDefinition[];
  readonly destructiveOperationIds: readonly string[];
}

function digest(parts: readonly string[]): string {
  // Non-cryptographic FNV-1a hash: demo plans are never trusted, only bound to the preview shown.
  let hash = 0x811c9dc5;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `demo-${hash.toString(16).padStart(8, "0")}`;
}

function convertsToNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  return typeof value === "number" || (typeof value === "string" && Number.isFinite(Number(value)));
}

export function buildDemoPlan(
  table: TableDefinition,
  draftFields: readonly FieldDefinition[],
  rows: readonly RecordEnvelope[],
): { readonly preview: MigrationPreview; readonly record: DemoPlanRecord } {
  const liveById = new Map(table.fields.map((f) => [f.id, f]));
  const draftById = new Map(draftFields.map((f) => [f.id, f]));
  const tableId = brand<TableId>(table.id);
  const now = isoNow();
  const operations: MigrationOperation[] = [];
  const destructiveIds: string[] = [];
  const preflight: ConversionPreflightResult[] = [];
  const warnings: MigrationPreviewWarning[] = [];
  const opCounter = {
    value: 0,
    next(): number {
      this.value += 1;
      return this.value;
    },
  };
  const nextOpId = (kind: string): string => `op-${opCounter.next()}-${kind}`;

  for (const draft of draftFields) {
    const live = liveById.get(draft.id);
    if (!live) {
      operations.push({
        kind: "add-field",
        operationId: nextOpId("add-field"),
        tableId,
        summary: `Add ${draft.type} field "${draft.name}".`,
        after: snapshotField(draft),
      });
      continue;
    }
    if (live.type !== draft.type) {
      const operationId = nextOpId("change-field-type");
      operations.push({
        kind: "change-field-type",
        operationId,
        tableId,
        summary: `Convert "${live.name}" from ${live.type} to ${draft.type}.`,
        before: snapshotField(live),
        afterType: snapshotField(draft).type,
        conversion: {
          strategy: "registered-cast",
          expressionId: null,
          onNull: "preserve",
          onFailure: "reject-publish",
        },
      });
      const failing =
        draft.type === "number" ? rows.filter((r) => !convertsToNumber(r.values[live.key])) : [];
      preflight.push({
        tenantId: brand(table.tenantId),
        tableId,
        baseLiveVersion: table.version,
        draftRevision: 1,
        operationId,
        scannedRows: rows.length,
        convertibleRows: rows.length - failing.length,
        failedRows: failing.length,
        truncated: failing.length > 5,
        samples: failing.slice(0, 5).map((r) => ({
          recordId: r.id,
          incidentId: r.incidentId,
          reasonCode: "invalid-format" as const,
        })),
        checkedAt: now,
      });
      if (failing.length > 0) {
        warnings.push({
          code: "conversion-failures",
          message: `${failing.length} existing rows cannot be converted to ${draft.type}.`,
          operationIds: [operationId],
        });
      }
    } else if (live.name !== draft.name) {
      operations.push({
        kind: "rename-field",
        operationId: nextOpId("rename-field"),
        tableId,
        summary: `Rename "${live.name}" to "${draft.name}" (storage is unchanged).`,
        fieldId: brand(live.id),
        beforeDisplayName: live.name,
        afterDisplayName: draft.name,
      });
    }
  }

  for (const live of table.fields) {
    if (!draftById.has(live.id)) {
      const operationId = nextOpId("remove-field");
      destructiveIds.push(operationId);
      operations.push({
        kind: "remove-field",
        operationId,
        tableId,
        summary: `Remove "${live.name}". Its column is retained for 30 days and can be restored.`,
        before: snapshotField(live),
        tombstoneColumn: `_deleted_c_${shortId(live.id)}`,
        retainUntil: brand<IsoDateTime>(new Date(Date.now() + 30 * 86_400_000).toISOString()),
      });
    }
  }

  if (destructiveIds.length > 0) {
    warnings.push({
      code: "destructive-retained",
      message: "Removed fields are retained for 30 days before any hard delete.",
      operationIds: destructiveIds,
    });
  }
  const affectsActive = table.incidentScope === "incident" && operations.length > 0;
  if (affectsActive) {
    warnings.push({
      code: "active-incident-lock",
      message: "This table is in use by an active incident; changes take a brief lock.",
      operationIds: operations.map((o) => o.operationId),
    });
  }

  const steps: MigrationStep[] = operations.map((op, index) => ({
    stepId: `step-${index + 1}`,
    ordinal: index + 1,
    operationIds: [op.operationId],
    phase: "ddl",
    description: op.summary,
    statement: null,
    transaction: "enclosing",
    requiresExclusiveLock: op.kind !== "rename-field",
  }));

  const planId = brand<MigrationPlan["planId"]>(demoId());
  const diff = {
    tenantId: brand<MigrationPlan["diff"]["tenantId"]>(DEMO_TENANT_ID),
    tableId,
    baseLiveVersion: table.version,
    draftRevision: 1,
    operations,
    destructiveOperationIds: destructiveIds,
  };
  const plan: MigrationPlan = {
    planId,
    context: {
      tenantId: diff.tenantId,
      activeIncidentId: brand<IncidentId>(DEMO_INCIDENTS.harlowFlood),
      actor,
      requestId: brand(demoId()),
      correlationId: brand(demoId()),
      reason: "Demo schema change",
    },
    baseLiveVersion: table.version,
    draftRevision: 1,
    diff,
    steps,
    preflight,
    impact: {
      destructive: destructiveIds.length > 0,
      affectsActiveIncidents: affectsActive,
      estimatedRows: operations.length > 0 ? rows.length : 0,
      estimatedLockMilliseconds: operations.length > 0 ? 40 : 0,
      requiresMaintenanceWindow: false,
    },
    planDigest: digest([
      planId,
      String(table.version),
      ...operations.map((o) => `${o.operationId}:${o.summary}`),
    ]),
    createdAt: now,
    expiresAt: brand<IsoDateTime>(new Date(Date.now() + 15 * 60_000).toISOString()),
  };

  const failed = preflight.some((p) => p.failedRows > 0);
  return {
    preview: { plan, statements: [], warnings, canPublish: !failed },
    record: { plan, draftFields, destructiveOperationIds: destructiveIds },
  };
}
