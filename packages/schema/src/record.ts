import { z } from "zod";
import { idSchema, timestampSchema } from "./primitives.js";

/** Optimistic record version incremented atomically with every non-audit mutation. */
export const recordVersionSchema = z.number().int().positive();
export type RecordVersion = z.infer<typeof recordVersionSchema>;

/**
 * System columns present on every physical user table, plus permission-filtered field values.
 * Global records have a null incident ID; incident records must match the authorized operation context.
 */
export const recordEnvelopeSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  tableId: idSchema,
  incidentId: idSchema.nullable(),
  values: z.record(z.string(), z.unknown()),
  createdAt: timestampSchema,
  createdBy: idSchema,
  createdPositionId: idSchema,
  updatedAt: timestampSchema,
  updatedBy: idSchema,
  updatedPositionId: idSchema,
  version: recordVersionSchema,
  deletedAt: timestampSchema.nullable(),
});
export type RecordEnvelope = z.infer<typeof recordEnvelopeSchema>;

/** Create input. Actor, tenant and incident IDs come from server context, never from caller-supplied values. */
export const createRecordInputSchema = z.strictObject({
  tableId: idSchema,
  incidentId: idSchema.nullable(),
  values: z.record(z.string(), z.unknown()),
});
export type CreateRecordInput = z.infer<typeof createRecordInputSchema>;

/** Per-field optimistic patch. The API rejects stale base versions and reports same-field conflicts explicitly. */
export const updateRecordInputSchema = z.strictObject({
  tableId: idSchema,
  recordId: idSchema,
  baseVersion: recordVersionSchema,
  values: z.record(z.string(), z.unknown()),
});
export type UpdateRecordInput = z.infer<typeof updateRecordInputSchema>;

/** A same-field write conflict; values are returned only when the caller can read that field. */
export const recordFieldConflictSchema = z.strictObject({
  fieldId: idSchema,
  baseValue: z.unknown(),
  incomingValue: z.unknown(),
  currentValue: z.unknown(),
  currentVersion: recordVersionSchema,
});
export type RecordFieldConflict = z.infer<typeof recordFieldConflictSchema>;
