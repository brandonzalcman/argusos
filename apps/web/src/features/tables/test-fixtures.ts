import type { FieldDefinition, RecordEnvelope } from "@argus/schema";

/** TEST FIXTURES ONLY. Never imported by runtime code; these are not operational data. */
const base = {
  description: null,
  required: false,
  unique: false,
  indexed: false,
  defaultValue: null,
  sensitivity: "standard",
  access: { defaultMode: "editable", positions: [], accessRule: null },
} as const;

export const fixtureTitle = {
  ...base,
  id: "00000000-0000-4000-8000-000000000001",
  key: "title",
  name: "Title",
  type: "text",
  config: { maxLength: null, multiline: false },
} as unknown as FieldDefinition;

export const fixtureCount = {
  ...base,
  id: "00000000-0000-4000-8000-000000000002",
  key: "count",
  name: "Count",
  type: "number",
  config: { precision: null, scale: null, minimum: null, maximum: null },
} as unknown as FieldDefinition;

export const fixtureStatus = {
  ...base,
  id: "00000000-0000-4000-8000-000000000003",
  key: "state",
  name: "State",
  type: "single-select",
  config: {
    options: [
      { id: "opt-open", label: "Open", color: null, order: 0, archived: false },
      { id: "opt-done", label: "Done", color: null, order: 1, archived: false },
    ],
  },
} as unknown as FieldDefinition;

export const fixtureFields: readonly FieldDefinition[] = [
  fixtureTitle,
  fixtureCount,
  fixtureStatus,
];

export function fixtureRecord(
  n: number,
  values: Record<string, unknown>,
  version = 1,
): RecordEnvelope {
  const id = `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    id,
    tenantId: "20000000-0000-4000-8000-000000000000",
    tableId: "30000000-0000-4000-8000-000000000000",
    incidentId: null,
    values,
    createdAt: `2026-01-01T00:00:${String(n % 60).padStart(2, "0")}Z`,
    createdBy: "40000000-0000-4000-8000-000000000000",
    createdPositionId: "50000000-0000-4000-8000-000000000000",
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: "40000000-0000-4000-8000-000000000000",
    updatedPositionId: "50000000-0000-4000-8000-000000000000",
    version,
    deletedAt: null,
  };
}
