import { z } from "zod";
import { idSchema, timestampSchema } from "./primitives.js";

/** Draft/publish lifecycle shared by metadata-driven definitions. */
export const definitionLifecycleSchema = z.enum(["draft", "published", "archived"]);
export type DefinitionLifecycle = z.infer<typeof definitionLifecycleSchema>;

/** Positive integer revision used for optimistic definition updates and immutable published history. */
export const definitionRevisionNumberSchema = z.number().int().positive();
export type DefinitionRevisionNumber = z.infer<typeof definitionRevisionNumberSchema>;

/** Immutable reference to a definition revision; runtime consumers must not silently follow a newer version. */
export const definitionReferenceSchema = z.strictObject({
  definitionId: idSchema,
  version: definitionRevisionNumberSchema,
});
export type DefinitionReference = z.infer<typeof definitionReferenceSchema>;

/**
 * Revision metadata embedded in versioned definitions.
 * Updates must compare `version`; publishing creates an immutable audit event with actor and position context.
 */
export const definitionMetadataSchema = z.strictObject({
  id: idSchema,
  version: definitionRevisionNumberSchema,
  lifecycle: definitionLifecycleSchema,
  changeSummary: z.string().max(2_000).nullable(),
  createdAt: timestampSchema,
  createdBy: idSchema,
  createdPositionId: idSchema,
  publishedAt: timestampSchema.nullable(),
  publishedBy: idSchema.nullable(),
});
export type DefinitionMetadata = z.infer<typeof definitionMetadataSchema>;

/** Tenant-owned versioned definition base. Tenant ID is authoritative and cannot be changed during import. */
export const tenantVersionedDefinitionBaseSchema = definitionMetadataSchema.extend({
  tenantId: idSchema,
});

/**
 * Wraps an arbitrary payload in an explicit immutable definition reference.
 * Input: payload schema. Output: strict versioned transport schema. Errors: Zod parsing rejects mismatched
 * references, metadata or payloads. Depends on persistence to enforce tenant isolation, compare versions and audit.
 */
export function versionedDefinitionSchema<TPayload extends z.ZodType>(payload: TPayload) {
  return z.strictObject({
    reference: definitionReferenceSchema,
    metadata: definitionMetadataSchema,
    payload,
  });
}

/** Generic inferred form of a versioned definition transport envelope. */
export interface VersionedDefinition<TPayload> {
  reference: DefinitionReference;
  metadata: DefinitionMetadata;
  payload: TPayload;
}

/** Publication request protected by optimistic versioning and an auditable summary. */
export const publishDefinitionSchema = z.strictObject({
  reference: definitionReferenceSchema,
  expectedVersion: definitionRevisionNumberSchema,
  changeSummary: z.string().min(1).max(2_000),
});
export type PublishDefinition = z.infer<typeof publishDefinitionSchema>;
