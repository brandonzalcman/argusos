import { z } from "zod";
import { viewAccessPolicySchema } from "./access.js";
import { celExpressionSchema, idSchema, jsonValueSchema } from "./primitives.js";

/** Block kinds listed in plan section 6.2; renderer implementations belong to @argus/blocks. */
export const blockTypeSchema = z.enum([
  "field-input",
  "field-display",
  "record-list",
  "related-records",
  "stat",
  "chart",
  "map",
  "timeline",
  "rich-text",
  "image",
  "button",
  "tabs",
  "section",
  "divider",
  "embed",
  "comments",
  "checklist",
  "attachment-gallery",
  "countdown",
  "weather",
  /** Embeds a published board (pages only). */
  "board-embed",
  /** List of links to boards, pages and URLs (pages and homepages). */
  "link-list",
  /** User-written component rendered in the sandboxed iframe runtime; see component.ts. */
  "custom-component",
]);
export type BlockType = z.infer<typeof blockTypeSchema>;

/** Declarative action invoked by a block; execution must recheck operation context and expected record version. */
export const blockActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("open-board"), boardId: idSchema, viewId: idSchema.nullable() }),
  z.strictObject({
    type: z.literal("open-record"),
    tableId: idSchema,
    recordIdExpression: celExpressionSchema,
  }),
  z.strictObject({
    type: z.literal("run-workflow"),
    workflowId: idSchema,
    inputExpression: celExpressionSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal("create-record"),
    tableId: idSchema,
    defaultsExpression: celExpressionSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal("open-url"),
    url: z.string().url().max(2_048),
    openInNewTab: z.boolean(),
  }),
]);
export type BlockAction = z.infer<typeof blockActionSchema>;

/**
 * Board block configuration. `config` is interpreted by the matching block plugin and is not trusted as HTML.
 * Embed/image URLs require host allowlists and sandboxing at render time; visibility never replaces authorization.
 */
export const blockDefinitionSchema = z.strictObject({
  id: idSchema,
  type: blockTypeSchema,
  name: z.string().min(1).max(200),
  config: z.record(z.string(), jsonValueSchema),
  visibilityExpression: celExpressionSchema.nullable(),
  action: blockActionSchema.nullable(),
  access: viewAccessPolicySchema,
});
export type BlockDefinition = z.infer<typeof blockDefinitionSchema>;
