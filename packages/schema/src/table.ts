import { z } from "zod";
import { recordAccessPolicySchema } from "./access.js";
import { incidentScopeSchema } from "./context.js";
import { fieldDefinitionSchema } from "./field.js";
import { definitionKeySchema, physicalTableNameSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/**
 * Versioned catalog definition for a physical user table.
 * `physicalName` is engine-allocated, never interpolated from `name` or `key`; incident scope and access
 * policies must be enforced by generated APIs, realtime filters and PostgreSQL RLS.
 */
export const tableDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable(),
  physicalName: physicalTableNameSchema,
  incidentScope: incidentScopeSchema,
  fields: z.array(fieldDefinitionSchema),
  access: recordAccessPolicySchema,
  softDelete: z.boolean(),
  audit: z.boolean(),
});
export type TableDefinition = z.infer<typeof tableDefinitionSchema>;
