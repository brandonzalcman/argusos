import { z } from "zod";
import { boardDefinitionSchema } from "./board.js";
import { layoutDefinitionSchema } from "./layout.js";
import { menuDefinitionSchema } from "./menu.js";
import { idSchema, semanticVersionSchema } from "./primitives.js";
import { relationDefinitionSchema } from "./relation.js";
import { tableDefinitionSchema } from "./table.js";
import { viewDefinitionSchema } from "./view.js";
import { workflowDefinitionSchema } from "./workflow.js";

/** Portable dependency constraint. Range resolution and compatibility checks are performed during import preview. */
export const packDependencySchema = z.strictObject({
  packId: idSchema,
  versionRange: z.string().min(1).max(100),
  optional: z.boolean(),
});
export type PackDependency = z.infer<typeof packDependencySchema>;

/** Versioned `.argus.json` manifest. Checksums cover canonical content and are not a substitute for signatures. */
export const packDefinitionSchema = z.strictObject({
  formatVersion: z.literal(1),
  id: idSchema,
  name: z.string().min(1).max(200),
  version: semanticVersionSchema,
  description: z.string().max(5_000).nullable(),
  minimumArgusVersion: semanticVersionSchema,
  dependencies: z.array(packDependencySchema),
  contentChecksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
});
export type PackDefinition = z.infer<typeof packDefinitionSchema>;

/**
 * Portable board-pack payload. Import must preview dependencies, allocate new IDs, overwrite tenant IDs from
 * the authenticated target tenant, preserve audit provenance and publish only after the complete transaction.
 */
export const packBundleSchema = z.strictObject({
  manifest: packDefinitionSchema,
  tables: z.array(tableDefinitionSchema),
  relations: z.array(relationDefinitionSchema),
  views: z.array(viewDefinitionSchema),
  layouts: z.array(layoutDefinitionSchema),
  boards: z.array(boardDefinitionSchema),
  workflows: z.array(workflowDefinitionSchema),
  menus: z.array(menuDefinitionSchema),
});
export type PackBundle = z.infer<typeof packBundleSchema>;
