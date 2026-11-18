import { z } from "zod";
import { viewAccessPolicySchema } from "./access.js";
import { celExpressionSchema, idSchema, jsonValueSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

export const viewKindSchema = z.enum([
  "grid",
  "detail",
  "form",
  "kanban",
  "timeline",
  "calendar",
  "map",
  "chart",
  "gallery",
  "printable-report",
]);
export type ViewKind = z.infer<typeof viewKindSchema>;

export const filterOperatorSchema = z.enum([
  "equals",
  "not-equals",
  "contains",
  "not-contains",
  "starts-with",
  "ends-with",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
  "before",
  "after",
  "in",
  "not-in",
  "is-empty",
  "is-not-empty",
  "intersects",
  "within",
]);
export type FilterOperator = z.infer<typeof filterOperatorSchema>;

/** A structured filter predicate. Values are bound parameters and must never be interpolated into SQL. */
export const filterConditionSchema = z.strictObject({
  fieldId: idSchema,
  operator: filterOperatorSchema,
  value: jsonValueSchema.nullable(),
});
export type FilterCondition = z.infer<typeof filterConditionSchema>;

export interface FilterGroup {
  conjunction: "and" | "or";
  conditions: FilterCondition[];
  groups: FilterGroup[];
}

/** Recursive boolean filter tree; depth, node count and field permissions are validated by the query layer. */
export const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
  z.strictObject({
    conjunction: z.enum(["and", "or"]),
    conditions: z.array(filterConditionSchema),
    groups: z.array(filterGroupSchema),
  }),
);

export const viewSortSchema = z.strictObject({
  fieldId: idSchema,
  direction: z.enum(["ascending", "descending"]),
  nulls: z.enum(["first", "last"]),
});
export type ViewSort = z.infer<typeof viewSortSchema>;

export const viewGroupingSchema = z.strictObject({
  fieldId: idSchema,
  direction: z.enum(["ascending", "descending"]),
  collapsed: z.boolean(),
});
export type ViewGrouping = z.infer<typeof viewGroupingSchema>;

/** CEL-controlled row colour. Expressions are sandboxed and cannot bypass hidden-field restrictions. */
export const viewColorRuleSchema = z.strictObject({
  id: idSchema,
  expression: celExpressionSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type ViewColorRule = z.infer<typeof viewColorRuleSchema>;

/** Saved view over one table. All filters run in addition to incident scoping and authorization predicates. */
export const viewDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  tableId: idSchema,
  name: z.string().min(1).max(200),
  kind: viewKindSchema,
  filters: filterGroupSchema.nullable(),
  sorts: z.array(viewSortSchema),
  grouping: viewGroupingSchema.nullable(),
  fieldOrder: z.array(idSchema),
  hiddenFieldIds: z.array(idSchema),
  colorRules: z.array(viewColorRuleSchema),
  access: viewAccessPolicySchema,
  publicForm: z.boolean(),
});
export type ViewDefinition = z.infer<typeof viewDefinitionSchema>;
