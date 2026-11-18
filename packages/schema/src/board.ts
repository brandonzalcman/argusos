import { z } from "zod";
import { viewAccessPolicySchema } from "./access.js";
import { blockDefinitionSchema } from "./block.js";
import { celExpressionSchema, definitionKeySchema, idSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/** Table source with a stable CEL alias. Source filters supplement, and never replace, tenant/incident/RLS filters. */
export const boardDataSourceSchema = z.strictObject({
  alias: definitionKeySchema,
  tableId: idSchema,
  filterExpression: celExpressionSchema.nullable(),
});
export type BoardDataSource = z.infer<typeof boardDataSourceSchema>;

/** Board tab referencing a saved view and optionally narrowing it to selected positions. */
export const boardViewSchema = z.strictObject({
  id: idSchema,
  viewId: idSchema,
  name: z.string().min(1).max(200),
  access: viewAccessPolicySchema,
});
export type BoardView = z.infer<typeof boardViewSchema>;

/** Versioned no-code board document interpreted by web and mobile runtimes without code generation. */
export const boardDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable(),
  dataSources: z.array(boardDataSourceSchema).min(1),
  views: z.array(boardViewSchema).min(1),
  blocks: z.array(blockDefinitionSchema),
  layoutId: idSchema,
  access: viewAccessPolicySchema,
});
export type BoardDefinition = z.infer<typeof boardDefinitionSchema>;
