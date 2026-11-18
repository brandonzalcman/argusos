import { z } from "zod";
import { idSchema, timestampSchema } from "./primitives.js";

/** Field-level before/after diff. Hidden values are redacted for readers but retained in restricted audit storage. */
export const auditFieldChangeSchema = z.strictObject({
  fieldId: idSchema,
  previousValue: z.unknown(),
  nextValue: z.unknown(),
  redacted: z.boolean(),
});
export type AuditFieldChange = z.infer<typeof auditFieldChangeSchema>;

/**
 * Append-only record-change event corresponding to `audit.record_changes`.
 * Actor, position, tenant, incident and request IDs are server-derived; entries cannot be updated or deleted
 * through normal application APIs, and exports can add signatures without mutating the source event.
 */
export const auditRecordChangeSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  tableId: idSchema,
  recordId: idSchema,
  incidentId: idSchema.nullable(),
  operation: z.enum(["create", "update", "soft-delete", "restore"]),
  changes: z.array(auditFieldChangeSchema),
  previousRecordVersion: z.number().int().positive().nullable(),
  recordVersion: z.number().int().positive(),
  actorUserId: idSchema,
  actorPositionId: idSchema,
  requestId: idSchema,
  occurredAt: timestampSchema,
  previousEntryHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  entryHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
});
export type AuditRecordChange = z.infer<typeof auditRecordChangeSchema>;

/** Audit event for publishing or restoring a metadata definition, kept separate from user record changes. */
export const auditDefinitionChangeSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  definitionKind: z.string().min(1).max(100),
  definitionId: idSchema,
  previousVersion: z.number().int().positive().nullable(),
  version: z.number().int().positive(),
  operation: z.enum(["create-draft", "update-draft", "publish", "restore", "archive"]),
  changeSummary: z.string().max(2_000).nullable(),
  actorUserId: idSchema,
  actorPositionId: idSchema,
  requestId: idSchema,
  occurredAt: timestampSchema,
});
export type AuditDefinitionChange = z.infer<typeof auditDefinitionChangeSchema>;
