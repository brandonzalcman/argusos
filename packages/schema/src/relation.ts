import { z } from "zod";
import { idSchema, physicalTableNameSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/** Cardinality determines whether the DDL engine plans an FK column or a managed junction table. */
export const relationCardinalitySchema = z.enum(["one-to-many", "many-to-many"]);
export type RelationCardinality = z.infer<typeof relationCardinalitySchema>;

/**
 * Tenant-local relation between two published table definitions.
 * Source/target tenants and incident scopes must be checked before migration; cascades require an explicit
 * security review because deleting a parent can otherwise remove audit-relevant descendant records.
 */
export const relationDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  name: z.string().min(1).max(200),
  sourceTableId: idSchema,
  sourceFieldId: idSchema.nullable(),
  targetTableId: idSchema,
  targetFieldId: idSchema.nullable(),
  cardinality: relationCardinalitySchema,
  inverseName: z.string().min(1).max(200).nullable(),
  junctionPhysicalName: physicalTableNameSchema.nullable(),
  onDelete: z.enum(["restrict", "set-null", "cascade"]),
});
export type RelationDefinition = z.infer<typeof relationDefinitionSchema>;
