import type { ComponentProp, CustomComponentDefinition } from "@argus/schema";

/**
 * Props passed to the sandbox: declared defaults first, then the values authored on the block.
 * Authored values win; `undefined` never overrides a default. Pure; never mutates its inputs.
 */
export function mergeComponentProps(
  declared: readonly ComponentProp[],
  authored: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const prop of declared) {
    if (prop.defaultValue !== null) merged[prop.key] = prop.defaultValue;
  }
  for (const [key, value] of Object.entries(authored)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

export type ComponentAvailability = "ok" | "unpublished";

/**
 * Runtime blocks run only versions that were published (a superseded version keeps `publishedAt`).
 * The builder may preview an unpublished draft version.
 */
export function componentAvailability(
  definition: Pick<CustomComponentDefinition, "publishedAt">,
  mode: "builder" | "runtime" | string,
): ComponentAvailability {
  return mode === "builder" || definition.publishedAt !== null ? "ok" : "unpublished";
}

/** Reads `{componentId, componentVersion, props}` defensively from an untyped block config. */
export function readComponentConfig(config: Readonly<Record<string, unknown>>): {
  readonly componentId: string;
  readonly componentVersion: number;
  readonly props: Readonly<Record<string, unknown>>;
} | null {
  const { componentId, componentVersion, props } = config;
  if (typeof componentId !== "string" || componentId === "") return null;
  if (typeof componentVersion !== "number" || !Number.isInteger(componentVersion)) return null;
  if (componentVersion < 1) return null;
  const record =
    props !== null && typeof props === "object" && !Array.isArray(props)
      ? (props as Record<string, unknown>)
      : {};
  return { componentId, componentVersion, props: record };
}
