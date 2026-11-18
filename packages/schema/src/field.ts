import { z } from "zod";
import { fieldAccessPolicySchema } from "./access.js";
import {
  celExpressionSchema,
  definitionKeySchema,
  idSchema,
  jsonValueSchema,
} from "./primitives.js";

/** The first twelve field types scheduled for the Phase 1 table slice, in plan section 5.3 order. */
export const coreFieldTypeIds = [
  "text",
  "long-text",
  "number",
  "currency",
  "percent",
  "date",
  "date-time",
  "duration",
  "boolean",
  "single-select",
  "multi-select",
  "user",
] as const;
export type CoreFieldTypeId = (typeof coreFieldTypeIds)[number];

/** Field types reserved for later vertical slices; their contracts are stable but behavior remains unimplemented. */
export const laterFieldTypeIds = [
  "position",
  "link-to-record",
  "attachment",
  "location",
  "phone",
  "email",
  "url",
  "status",
  "formula",
  "rollup",
  "lookup",
  "auto-number",
  "signature",
  "json",
] as const;
export type LaterFieldTypeId = (typeof laterFieldTypeIds)[number];

export const fieldTypeIdSchema = z.enum([...coreFieldTypeIds, ...laterFieldTypeIds]);
export type FieldTypeId = z.infer<typeof fieldTypeIdSchema>;

/** Shared field invariants. Physical column allocation and SQL generation are owned by the DDL engine. */
export const fieldDefinitionBaseSchema = z.strictObject({
  id: idSchema,
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable(),
  required: z.boolean(),
  unique: z.boolean(),
  indexed: z.boolean(),
  defaultValue: jsonValueSchema.nullable(),
  sensitivity: z.enum(["standard", "personal", "confidential", "restricted"]),
  access: fieldAccessPolicySchema,
});
export type FieldDefinitionBase = z.infer<typeof fieldDefinitionBaseSchema>;

export const textFieldConfigSchema = z.strictObject({
  maxLength: z.number().int().positive().max(10_000).nullable(),
  multiline: z.boolean(),
});
export const longTextFieldConfigSchema = z.strictObject({
  format: z.enum(["plain", "markdown", "rich-text"]),
});
export const numberFieldConfigSchema = z.strictObject({
  precision: z.number().int().min(1).max(38).nullable(),
  scale: z.number().int().min(0).max(20).nullable(),
  minimum: z.number().finite().nullable(),
  maximum: z.number().finite().nullable(),
});
export const currencyFieldConfigSchema = z.strictObject({
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  scale: z.number().int().min(0).max(8),
});
export const percentFieldConfigSchema = z.strictObject({
  scale: z.number().int().min(0).max(8),
  storage: z.enum(["fraction", "whole-number"]),
});
export const dateFieldConfigSchema = z.strictObject({
  minimum: z.string().date().nullable(),
  maximum: z.string().date().nullable(),
});
export const dateTimeFieldConfigSchema = z.strictObject({
  displayTimeZone: z.string().min(1).max(100).nullable(),
  minimum: z.string().datetime({ offset: true }).nullable(),
  maximum: z.string().datetime({ offset: true }).nullable(),
});
export const durationFieldConfigSchema = z.strictObject({
  storageUnit: z.enum(["milliseconds", "seconds", "minutes"]),
  displayUnit: z.enum(["automatic", "minutes", "hours", "days"]),
});
export const booleanFieldConfigSchema = z.strictObject({
  trueLabel: z.string().min(1).max(100),
  falseLabel: z.string().min(1).max(100),
});

export const selectOptionSchema = z.strictObject({
  id: idSchema,
  label: z.string().min(1).max(200),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  order: z.number().int().nonnegative(),
  archived: z.boolean(),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

export const singleSelectFieldConfigSchema = z.strictObject({
  options: z.array(selectOptionSchema),
});
export const multiSelectFieldConfigSchema = z.strictObject({
  options: z.array(selectOptionSchema),
  maximumSelections: z.number().int().positive().nullable(),
});
export const userFieldConfigSchema = z.strictObject({
  allowedPositionIds: z.array(idSchema),
});
export const positionFieldConfigSchema = z.strictObject({
  allowedPositionIds: z.array(idSchema),
});
export const linkToRecordFieldConfigSchema = z.strictObject({
  relationId: idSchema,
  targetTableId: idSchema,
  allowMultiple: z.boolean(),
});
export const attachmentFieldConfigSchema = z.strictObject({
  maximumFiles: z.number().int().positive().nullable(),
  maximumBytesPerFile: z.number().int().positive(),
  allowedMimeTypes: z.array(z.string().min(1).max(255)),
});
export const locationFieldConfigSchema = z.strictObject({
  geometry: z.enum(["point", "linestring", "polygon", "geometry"]),
  srid: z.literal(4326),
});
export const phoneFieldConfigSchema = z.strictObject({
  defaultRegion: z.string().length(2).nullable(),
});
export const emailFieldConfigSchema = z.strictObject({
  allowedDomains: z.array(z.string().min(1).max(255)),
});
export const urlFieldConfigSchema = z.strictObject({
  allowedProtocols: z.array(z.enum(["https", "http"])).min(1),
});
export const statusFieldConfigSchema = z.strictObject({
  options: z.array(selectOptionSchema).min(1),
  initialOptionId: idSchema.nullable(),
  closedOptionIds: z.array(idSchema),
});
export const formulaFieldConfigSchema = z.strictObject({
  expression: celExpressionSchema,
  resultType: fieldTypeIdSchema.nullable(),
  execution: z.enum(["sql-generated", "sql-view", "application"]),
});
export const rollupFieldConfigSchema = z.strictObject({
  relationId: idSchema,
  targetFieldId: idSchema,
  aggregation: z.enum(["count", "sum", "average", "minimum", "maximum", "concatenate"]),
});
export const lookupFieldConfigSchema = z.strictObject({
  relationId: idSchema,
  targetFieldId: idSchema,
});
export const autoNumberFieldConfigSchema = z.strictObject({
  prefix: z.string().max(30),
  padding: z.number().int().min(1).max(12),
  scope: z.enum(["tenant", "incident"]),
});
export const signatureFieldConfigSchema = z.strictObject({
  meaning: z.string().min(1).max(500),
  requireReauthentication: z.boolean(),
});
export const jsonFieldConfigSchema = z.strictObject({
  jsonSchema: jsonValueSchema.nullable(),
});

/** Discriminated field definition preserving a specific config shape for every plan section 5.3 type. */
export const fieldDefinitionSchema = z.discriminatedUnion("type", [
  fieldDefinitionBaseSchema.extend({ type: z.literal("text"), config: textFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("long-text"),
    config: longTextFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("number"), config: numberFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("currency"),
    config: currencyFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("percent"),
    config: percentFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("date"), config: dateFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("date-time"),
    config: dateTimeFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("duration"),
    config: durationFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("boolean"),
    config: booleanFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("single-select"),
    config: singleSelectFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("multi-select"),
    config: multiSelectFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("user"), config: userFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("position"),
    config: positionFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("link-to-record"),
    config: linkToRecordFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("attachment"),
    config: attachmentFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("location"),
    config: locationFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("phone"), config: phoneFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("email"), config: emailFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("url"), config: urlFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("status"), config: statusFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("formula"),
    config: formulaFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("rollup"), config: rollupFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("lookup"), config: lookupFieldConfigSchema }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("auto-number"),
    config: autoNumberFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({
    type: z.literal("signature"),
    config: signatureFieldConfigSchema,
  }),
  fieldDefinitionBaseSchema.extend({ type: z.literal("json"), config: jsonFieldConfigSchema }),
]);
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
