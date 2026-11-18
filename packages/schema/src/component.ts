import { z } from "zod";
import { blockTypeSchema } from "./block.js";
import { pluginCapabilitySchema } from "./plugin.js";
import { definitionKeySchema, idSchema, jsonValueSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/** Maximum custom component source size, in characters. */
export const CUSTOM_COMPONENT_SOURCE_MAX_LENGTH = 200_000;

/** Editor control used for a component prop in the builder inspector. */
export const componentPropTypeSchema = z.enum([
  "string",
  "text",
  "number",
  "boolean",
  "enum",
  "color",
  "cel",
  "table",
  "field",
  "board",
  "page",
  "url",
]);
export type ComponentPropType = z.infer<typeof componentPropTypeSchema>;

/** Declared input of a custom component, edited with no-code controls when the block is placed. */
export const componentPropSchema = z.strictObject({
  key: definitionKeySchema,
  label: z.string().min(1).max(200),
  description: z.string().max(1_000).nullable(),
  type: componentPropTypeSchema,
  required: z.boolean(),
  defaultValue: jsonValueSchema.nullable(),
  /** Choices for `enum` props; must be empty for every other type. */
  options: z.array(z.strictObject({ value: z.string().max(200), label: z.string().max(200) })),
});
export type ComponentProp = z.infer<typeof componentPropSchema>;

/**
 * Custom interface component written in the browser (TSX) by users with the `editCode` permission.
 *
 * Security model (non-negotiable):
 * - Source is untrusted. It is compiled and executed only inside a sandboxed iframe
 *   (`sandbox="allow-scripts"`, opaque origin, strict CSP, no same-origin access), never in the
 *   application origin, and never on the server.
 * - The component reaches data only through the typed @argus/sdk message bridge, limited to the
 *   declared `capabilities`, which a publisher must approve and which are audited per tenant.
 * - Runtime blocks pin an exact published version; drafts render only in the builder preview.
 * - Hidden fields are removed by the host before data crosses the bridge.
 */
export const customComponentDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable(),
  language: z.literal("tsx"),
  source: z.string().min(1).max(CUSTOM_COMPONENT_SOURCE_MAX_LENGTH),
  props: z.array(componentPropSchema).max(50),
  capabilities: z.array(pluginCapabilitySchema),
  /** Built-in block this component was ejected from, for provenance; null when written from scratch. */
  ejectedFrom: blockTypeSchema.nullable(),
  /** Sandbox runtime API version the source targets. */
  sdkVersion: z.literal(1),
});
export type CustomComponentDefinition = z.infer<typeof customComponentDefinitionSchema>;

/** Block config for a placed custom component. Runtime always loads exactly `componentVersion`. */
export const customComponentBlockConfigSchema = z.strictObject({
  componentId: idSchema,
  componentVersion: z.number().int().positive(),
  props: z.record(z.string(), jsonValueSchema),
});
export type CustomComponentBlockConfigValue = z.infer<typeof customComponentBlockConfigSchema>;
