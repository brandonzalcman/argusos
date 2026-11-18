import type { FieldDefinition, FieldTypeId, FilterOperator } from "@argus/schema";
import { getFieldType, listFieldTypes } from "./field-registry.js";

export { getFieldType, listFieldTypes };

export function fieldTypeLabel(id: string): string {
  return getFieldType(id)?.metadata.displayName ?? `Unknown type (${id})`;
}

/** Operators the in-browser evaluator can honour. Spatial operators stay server-side. */
const clientOperators: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  "equals",
  "not-equals",
  "contains",
  "not-contains",
  "starts-with",
  "ends-with",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
  "before",
  "after",
  "in",
  "not-in",
  "is-empty",
  "is-not-empty",
]);

/** Filter operators registered for a field type that the grid can evaluate on live rows. */
export function filterOperatorsFor(typeId: FieldTypeId): readonly FilterOperator[] {
  const plugin = getFieldType(typeId);
  if (!plugin) {
    return [];
  }
  return plugin.filters.map((f) => f.operator).filter((op) => clientOperators.has(op));
}

const computedTypes: ReadonlySet<FieldTypeId> = new Set<FieldTypeId>([
  "formula",
  "rollup",
  "lookup",
  "auto-number",
]);

/** Fields whose values are produced by the engine and are never typed in. */
export function isComputedField(field: FieldDefinition): boolean {
  return computedTypes.has(field.type);
}

/**
 * Field types with an inline editor in this slice. Others render read-only with an honest label.
 * TODO(implementation): editors for location (map picker), signature (re-auth) and json.
 */
const inlineEditable: ReadonlySet<FieldTypeId> = new Set<FieldTypeId>([
  "text",
  "long-text",
  "number",
  "currency",
  "percent",
  "duration",
  "date",
  "date-time",
  "boolean",
  "single-select",
  "multi-select",
  "status",
  "phone",
  "email",
  "url",
  "user",
  "position",
  "link-to-record",
  "attachment",
]);

export function hasInlineEditor(field: FieldDefinition): boolean {
  return inlineEditable.has(field.type);
}

/** Server-authoritative access mode: only `editable` fields may be changed; hidden fields never reach the grid. */
export function isFieldEditable(field: FieldDefinition): boolean {
  return (
    field.access.defaultMode === "editable" && !isComputedField(field) && hasInlineEditor(field)
  );
}

export const operatorLabels: Readonly<Record<FilterOperator, string>> = {
  equals: "is",
  "not-equals": "is not",
  contains: "contains",
  "not-contains": "does not contain",
  "starts-with": "starts with",
  "ends-with": "ends with",
  "greater-than": ">",
  "greater-than-or-equal": "≥",
  "less-than": "<",
  "less-than-or-equal": "≤",
  before: "is before",
  after: "is after",
  in: "is any of",
  "not-in": "is none of",
  "is-empty": "is empty",
  "is-not-empty": "is not empty",
  intersects: "intersects",
  within: "is within",
};
