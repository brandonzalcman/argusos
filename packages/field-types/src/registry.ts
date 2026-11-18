import type { FieldTypeId } from "@argus/schema";
import type { AnyFieldTypePlugin, FieldTypePlugin } from "./contract.js";

/** Read-only registry used by table designer, API validation and host renderer resolution. */
export interface FieldTypeRegistry {
  /** Returns all registered plugins in deterministic registration order. */
  list(): readonly AnyFieldTypePlugin[];
  /** Reports whether an ID is registered; unknown IDs are never silently coerced to text. */
  has(id: string): boolean;
  /**
   * Resolves one plugin by stable ID.
   * Input: field type ID. Output: its plugin. Errors: unknown IDs must produce a typed lookup failure.
   * Depends on registry construction to have rejected duplicate IDs.
   */
  get<TId extends FieldTypeId>(id: TId): FieldTypePlugin<TId>;
}

/**
 * TODO(implementation): create an immutable field-type registry with uniqueness enforcement.
 * Input: installed plugins. Output: registry with deterministic lookup. Errors: duplicate IDs or malformed
 * metadata must reject construction before any definition or renderer uses the registry; currently always throws.
 * Depends on the pack/plugin loader for tenant-scoped installation and capability checks; performs no I/O.
 */
export function createFieldTypeRegistry(
  _plugins: readonly AnyFieldTypePlugin[],
): FieldTypeRegistry {
  throw new Error("TODO(implementation): createFieldTypeRegistry uniqueness and lookup");
}
