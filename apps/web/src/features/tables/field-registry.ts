import { type AnyFieldTypePlugin, allFieldTypePlugins } from "@argus/field-types";

/**
 * The ONLY file in the tables feature that touches the @argus/field-types plugin list directly.
 * `createFieldTypeRegistry()` still throws TODO(implementation), so this is a local read-only lookup
 * with the same contract (deterministic list, `has`, `get`; unknown ids are never coerced to text).
 * TODO(implementation): replace the body with createFieldTypeRegistry(allFieldTypePlugins) once it is
 * implemented; no other file needs to change.
 * Input: field type id. Output: the plugin or undefined. Errors: none. Depends on: @argus/field-types.
 */
const plugins: readonly AnyFieldTypePlugin[] = allFieldTypePlugins;
const byId: ReadonlyMap<string, AnyFieldTypePlugin> = new Map(plugins.map((p) => [p.id, p]));

export function listFieldTypes(): readonly AnyFieldTypePlugin[] {
  return plugins;
}

export function getFieldType(id: string): AnyFieldTypePlugin | undefined {
  return byId.get(id);
}
