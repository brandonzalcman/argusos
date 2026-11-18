import type { BlockKind } from "./block-configs.js";
import type { BlockCategory, BlockModule } from "./types.js";

/**
 * TODO(implementation): replace each generated renderer with its accessible authorized block UI.
 * Input: a known block kind plus stable palette metadata and category.
 * Output: a typed module whose render method throws instead of simulating records or actions.
 * Errors: render always throws TODO(implementation) naming the block kind.
 * Depends on: @argus/schema configuration validation, @argus/ui, and the scoped BoardDataPort.
 */
export function createBlockStub<K extends BlockKind>(
  kind: K,
  displayName: string,
  description: string,
  category: BlockCategory,
): BlockModule<K> {
  return {
    kind,
    displayName,
    description,
    category,
    render: () => {
      throw new Error(`TODO(implementation): render ${kind} block`);
    },
  };
}
