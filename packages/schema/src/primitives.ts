import { z } from "zod";

/** UUID used for opaque system identifiers; authorization must never rely on identifier predictability. */
export const idSchema = z.string().uuid();
export type Id = z.infer<typeof idSchema>;

/** Stable, human-editable key used inside definitions rather than as a SQL identifier. */
export const definitionKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,62}$/, "Expected a lower snake_case definition key.");
export type DefinitionKey = z.infer<typeof definitionKeySchema>;

/** Physical table alias allocated by the DDL engine; user-provided names must not become SQL identifiers. */
export const physicalTableNameSchema = z.string().regex(/^t_[a-z0-9]{1,30}$/);
export type PhysicalTableName = z.infer<typeof physicalTableNameSchema>;

/** RFC 3339 timestamp with an explicit offset; producers should persist UTC. */
export const timestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof timestampSchema>;

/** Semantic version for portable packs and plugins, distinct from integer definition revisions. */
export const semanticVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
export type SemanticVersion = z.infer<typeof semanticVersionSchema>;

/** CEL source text. Parsing, capability checks and SQL compilation belong to @argus/expr. */
export const celExpressionSchema = z.string().min(1).max(20_000);
export type CelExpression = z.infer<typeof celExpressionSchema>;

/** JSON-compatible value used for portable definition configuration and API diagnostics. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Validates JSON-compatible values without allowing class instances, bigint, undefined or functions. */
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
