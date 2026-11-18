import type { BlockKind } from "./block-configs.js";
import type { AnyBlockModule, BlockModule } from "./types.js";

export interface BlockRegistry {
  readonly list: () => readonly AnyBlockModule[];
  readonly get: <K extends BlockKind>(kind: K) => BlockModule<K>;
}

/**
 * Creates an immutable in-memory registry of typed block modules.
 * Input: unique block modules; no definitions are fetched or executed.
 * Output: listing and kind-safe lookup functions over the supplied modules.
 * Errors: duplicate registration and unknown lookup kinds throw descriptive errors.
 * Depends on: module metadata only; authorization is enforced by render/data implementations.
 */
export function createBlockRegistry(modules: readonly AnyBlockModule[]): BlockRegistry {
  const byKind = new Map<BlockKind, AnyBlockModule>();
  for (const module of modules) {
    if (byKind.has(module.kind)) {
      throw new Error(`Duplicate block registration: ${module.kind}`);
    }
    byKind.set(module.kind, module);
  }
  const snapshot = Object.freeze([...modules]);
  return {
    list: () => snapshot,
    get: <K extends BlockKind>(kind: K): BlockModule<K> => {
      const module = byKind.get(kind);
      if (!module) {
        throw new Error(`Unknown block kind: ${kind}`);
      }
      return module as unknown as BlockModule<K>;
    },
  };
}
