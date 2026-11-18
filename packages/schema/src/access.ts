import { z } from "zod";
import { celExpressionSchema, idSchema } from "./primitives.js";

/** Position-level CRUD policy. Empty position arrays deny that operation; API and Postgres RLS must both enforce it. */
export const recordAccessPolicySchema = z.strictObject({
  readPositionIds: z.array(idSchema),
  createPositionIds: z.array(idSchema),
  updatePositionIds: z.array(idSchema),
  deletePositionIds: z.array(idSchema),
  rowRule: celExpressionSchema.nullable(),
});
export type RecordAccessPolicy = z.infer<typeof recordAccessPolicySchema>;

/** Field access for a position. Hidden fields must also be removed from API payloads and realtime events. */
export const fieldAccessModeSchema = z.enum(["hidden", "read", "editable"]);
export type FieldAccessMode = z.infer<typeof fieldAccessModeSchema>;

/** Explicit position override; absence inherits the field's default access mode. */
export const fieldPositionAccessSchema = z.strictObject({
  positionId: idSchema,
  mode: fieldAccessModeSchema,
});
export type FieldPositionAccess = z.infer<typeof fieldPositionAccessSchema>;

/** Field-level RBAC plus optional ABAC rule evaluated with tenant, incident, user, position and record inputs. */
export const fieldAccessPolicySchema = z.strictObject({
  defaultMode: fieldAccessModeSchema,
  positions: z.array(fieldPositionAccessSchema),
  accessRule: celExpressionSchema.nullable(),
});
export type FieldAccessPolicy = z.infer<typeof fieldAccessPolicySchema>;

/** View access is an additional restriction, never a grant around table, record or field permissions. */
export const viewAccessPolicySchema = z.strictObject({
  positionIds: z.array(idSchema),
  visibilityRule: celExpressionSchema.nullable(),
});
export type ViewAccessPolicy = z.infer<typeof viewAccessPolicySchema>;
