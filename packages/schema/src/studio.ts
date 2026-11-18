import { z } from "zod";
import { blockTypeSchema } from "./block.js";
import { boardDefinitionSchema } from "./board.js";
import { customComponentDefinitionSchema } from "./component.js";
import { layoutDefinitionSchema } from "./layout.js";
import { pageDefinitionSchema } from "./page.js";
import { definitionKeySchema, idSchema, timestampSchema } from "./primitives.js";
import { definitionLifecycleSchema, definitionRevisionNumberSchema } from "./versioning.js";

/*
 * Studio ("dev mode") API contract: one generic draft → publish → rollback lifecycle for every
 * definition the in-browser builder edits. Implemented by apps/api as the tRPC router `studio`
 * (procedure names below) and consumed by apps/web through a port.
 *
 * Every procedure:
 * - derives tenant/user/position from the authenticated OperationContext (never from input),
 * - checks StudioPermissions (view/edit/publish/editCode) and per-definition access,
 * - uses optimistic versions (`baseVersion` / `expectedVersion`) and returns
 *   `definition-version-conflict` on mismatch,
 * - writes an immutable audit event for create, save, publish, rollback and archive,
 * - re-validates documents server-side with these schemas (client validation is a convenience).
 */

/** Definition kinds editable in dev mode. */
export const studioDefinitionKindSchema = z.enum(["board", "page", "component"]);
export type StudioDefinitionKind = z.infer<typeof studioDefinitionKindSchema>;

/** A board and the layout it references, edited and published together. */
export const boardBundleSchema = z.strictObject({
  definition: boardDefinitionSchema,
  layout: layoutDefinitionSchema,
});
export type BoardBundleDocument = z.infer<typeof boardBundleSchema>;

/** The document stored per definition kind. */
export const studioDocumentSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("board"), bundle: boardBundleSchema }),
  z.strictObject({ kind: z.literal("page"), definition: pageDefinitionSchema }),
  z.strictObject({ kind: z.literal("component"), definition: customComponentDefinitionSchema }),
]);
export type StudioDocument = z.infer<typeof studioDocumentSchema>;

/** Per-definition permissions for the caller (subset of their StudioPermissions). */
export const studioItemPermissionsSchema = z.strictObject({
  view: z.boolean(),
  edit: z.boolean(),
  publish: z.boolean(),
  editCode: z.boolean(),
});
export type StudioItemPermissions = z.infer<typeof studioItemPermissionsSchema>;

/** List row for the studio catalog. */
export const studioDefinitionSummarySchema = z.strictObject({
  id: idSchema,
  kind: studioDefinitionKindSchema,
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable(),
  /** Pages only: the URL slug. */
  slug: z.string().max(80).nullable(),
  publishedVersion: definitionRevisionNumberSchema.nullable(),
  draftVersion: definitionRevisionNumberSchema.nullable(),
  /** True when a draft exists that differs from the published version. */
  hasUnpublishedChanges: z.boolean(),
  updatedAt: timestampSchema,
  updatedBy: idSchema,
  publishedAt: timestampSchema.nullable(),
  permissions: studioItemPermissionsSchema,
});
export type StudioDefinitionSummary = z.infer<typeof studioDefinitionSummarySchema>;

export const studioVersionSummarySchema = z.strictObject({
  version: definitionRevisionNumberSchema,
  lifecycle: definitionLifecycleSchema,
  changeSummary: z.string().max(2_000).nullable(),
  createdAt: timestampSchema,
  createdBy: idSchema,
  publishedAt: timestampSchema.nullable(),
  publishedBy: idSchema.nullable(),
});
export type StudioVersionSummary = z.infer<typeof studioVersionSummarySchema>;

/** `studio.list` */
export const studioListInputSchema = z.strictObject({
  kind: studioDefinitionKindSchema,
  search: z.string().max(200).nullable(),
  cursor: z.string().max(2_000).nullable(),
  limit: z.number().int().min(1).max(200),
});
export type StudioListInput = z.infer<typeof studioListInputSchema>;

export const studioListOutputSchema = z.strictObject({
  items: z.array(studioDefinitionSummarySchema),
  nextCursor: z.string().max(2_000).nullable(),
});
export type StudioListOutput = z.infer<typeof studioListOutputSchema>;

/** Which revision to read: the working draft, the live published one, or an exact version. */
export const studioRevisionSelectorSchema = z.union([
  z.literal("draft"),
  z.literal("published"),
  definitionRevisionNumberSchema,
]);
export type StudioRevisionSelector = z.infer<typeof studioRevisionSelectorSchema>;

/** `studio.get` — returns `null` for a missing draft; not-found for inaccessible ids. */
export const studioGetInputSchema = z.strictObject({
  kind: studioDefinitionKindSchema,
  id: idSchema,
  revision: studioRevisionSelectorSchema,
});
export type StudioGetInput = z.infer<typeof studioGetInputSchema>;

export const studioGetOutputSchema = z.strictObject({
  summary: studioDefinitionSummarySchema,
  version: definitionRevisionNumberSchema,
  document: studioDocumentSchema,
});
export type StudioGetOutput = z.infer<typeof studioGetOutputSchema>;

/** `studio.getPageBySlug` — runtime lookup of the published page for `/p/<slug>`. */
export const studioGetPageBySlugInputSchema = z.strictObject({ slug: z.string().min(1).max(80) });
export type StudioGetPageBySlugInput = z.infer<typeof studioGetPageBySlugInputSchema>;

/** How a new definition starts. */
export const studioCreateTemplateSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("blank") }),
  /** Board or page generated from a table's fields (list + detail + form). */
  z.strictObject({ type: z.literal("from-table"), tableId: idSchema }),
  /** Component whose source starts as an editable copy of a built-in block. */
  z.strictObject({ type: z.literal("eject-block"), blockType: blockTypeSchema }),
  /** Copy of another definition of the same kind (its published version). */
  z.strictObject({ type: z.literal("duplicate"), sourceId: idSchema }),
]);
export type StudioCreateTemplate = z.infer<typeof studioCreateTemplateSchema>;

/** `studio.create` — creates version 1 as a draft. */
export const studioCreateInputSchema = z.strictObject({
  kind: studioDefinitionKindSchema,
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  template: studioCreateTemplateSchema,
  idempotencyKey: z.string().min(8).max(200),
});
export type StudioCreateInput = z.infer<typeof studioCreateInputSchema>;

/** `studio.saveDraft` — replaces the draft if `baseVersion` is still current. */
export const studioSaveDraftInputSchema = z.strictObject({
  id: idSchema,
  baseVersion: definitionRevisionNumberSchema,
  document: studioDocumentSchema,
});
export type StudioSaveDraftInput = z.infer<typeof studioSaveDraftInputSchema>;

/** `studio.publish` — publishes the draft at `expectedVersion`. */
export const studioPublishInputSchema = z.strictObject({
  kind: studioDefinitionKindSchema,
  id: idSchema,
  expectedVersion: definitionRevisionNumberSchema,
  changeSummary: z.string().min(1).max(2_000),
  idempotencyKey: z.string().min(8).max(200),
});
export type StudioPublishInput = z.infer<typeof studioPublishInputSchema>;

/** `studio.rollback` — republishes an earlier version as a new version. */
export const studioRollbackInputSchema = z.strictObject({
  kind: studioDefinitionKindSchema,
  id: idSchema,
  expectedPublishedVersion: definitionRevisionNumberSchema,
  restoreVersion: definitionRevisionNumberSchema,
  changeSummary: z.string().min(1).max(2_000),
  idempotencyKey: z.string().min(8).max(200),
});
export type StudioRollbackInput = z.infer<typeof studioRollbackInputSchema>;

/** `studio.archive` — hides a definition from runtime; history is kept. */
export const studioArchiveInputSchema = z.strictObject({
  kind: studioDefinitionKindSchema,
  id: idSchema,
  expectedVersion: definitionRevisionNumberSchema,
  idempotencyKey: z.string().min(8).max(200),
});
export type StudioArchiveInput = z.infer<typeof studioArchiveInputSchema>;

export const studioMutationOutputSchema = z.strictObject({
  id: idSchema,
  version: definitionRevisionNumberSchema,
  auditEventId: idSchema,
});
export type StudioMutationOutput = z.infer<typeof studioMutationOutputSchema>;

/** Problem found while validating a document (Zod path, JSON-pointer-like). */
export const definitionIssueSchema = z.strictObject({
  path: z.array(z.union([z.string(), z.number().int()])),
  message: z.string().min(1).max(2_000),
  severity: z.enum(["error", "warning"]),
});
export type DefinitionIssue = z.infer<typeof definitionIssueSchema>;

/** `studio.validate` — server-side validation (schema, references, CEL, capabilities) without saving. */
export const studioValidateInputSchema = z.strictObject({ document: studioDocumentSchema });
export type StudioValidateInput = z.infer<typeof studioValidateInputSchema>;
export const studioValidateOutputSchema = z.strictObject({
  issues: z.array(definitionIssueSchema),
});
export type StudioValidateOutput = z.infer<typeof studioValidateOutputSchema>;

/**
 * Transport-independent shape of the `studio` router. apps/api implements it as tRPC procedures
 * with these names; apps/web wraps a typed client behind the same interface.
 */
export interface StudioApi {
  list(input: StudioListInput): Promise<StudioListOutput>;
  get(input: StudioGetInput): Promise<StudioGetOutput | null>;
  getPageBySlug(input: StudioGetPageBySlugInput): Promise<StudioGetOutput | null>;
  listVersions(input: { kind: StudioDefinitionKind; id: string }): Promise<StudioVersionSummary[]>;
  create(input: StudioCreateInput): Promise<StudioMutationOutput>;
  saveDraft(input: StudioSaveDraftInput): Promise<StudioMutationOutput>;
  publish(input: StudioPublishInput): Promise<StudioMutationOutput>;
  rollback(input: StudioRollbackInput): Promise<StudioMutationOutput>;
  archive(input: StudioArchiveInput): Promise<StudioMutationOutput>;
  validate(input: StudioValidateInput): Promise<StudioValidateOutput>;
}
