import type { FieldDefinition, RecordEnvelope, UpdateRecordInput } from "@argus/schema";
import { isFieldEditable } from "./field-catalog.js";
import { parseEditorInput } from "./parse-input.js";

/** One pasted cell aimed at a concrete record and field. */
export interface PastedCell {
  readonly record: RecordEnvelope;
  readonly field: FieldDefinition;
  readonly raw: string;
}

export interface BatchIssue {
  readonly recordId: string;
  readonly fieldName: string;
  readonly message: string;
}

/** A single-record patch plus what it replaces, so undo can restore it. */
export interface PlannedUpdate {
  readonly record: RecordEnvelope;
  readonly values: Readonly<Record<string, unknown>>;
  readonly previous: Readonly<Record<string, unknown>>;
}

export interface PastePlan {
  readonly updates: readonly PlannedUpdate[];
  readonly changedCells: number;
  readonly unchangedCells: number;
  readonly readOnlyCells: number;
  readonly issues: readonly BatchIssue[];
  /** Clipboard rows that fell past the end of the view and were ignored. */
  readonly overflowRows: number;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Plans a paste from Excel/Sheets without sending anything: parses each cell with the field's rules,
 * skips read-only fields and no-ops, and collects per-cell problems. Nothing is committed until the
 * operator confirms; the API re-validates and checks every baseVersion.
 */
export function planPaste(cells: readonly PastedCell[], overflowRows: number): PastePlan {
  const byRecord = new Map<
    string,
    { record: RecordEnvelope; values: Record<string, unknown>; previous: Record<string, unknown> }
  >();
  const issues: BatchIssue[] = [];
  let unchanged = 0;
  let readOnly = 0;
  let changed = 0;
  for (const { record, field, raw } of cells) {
    if (!isFieldEditable(field)) {
      readOnly += 1;
      continue;
    }
    const parsed = parseEditorInput(field, raw);
    if (!parsed.ok) {
      issues.push({ recordId: record.id, fieldName: field.name, message: parsed.message });
      continue;
    }
    if (same(parsed.value, record.values[field.key])) {
      unchanged += 1;
      continue;
    }
    const entry = byRecord.get(record.id) ?? { record, values: {}, previous: {} };
    entry.values[field.key] = parsed.value;
    entry.previous[field.key] = record.values[field.key] ?? null;
    byRecord.set(record.id, entry);
    changed += 1;
  }
  return {
    updates: [...byRecord.values()],
    changedCells: changed,
    unchangedCells: unchanged,
    readOnlyCells: readOnly,
    issues,
    overflowRows,
  };
}

export type BulkPlan =
  | { readonly ok: false; readonly message: string }
  | {
      readonly ok: true;
      readonly updates: readonly PlannedUpdate[];
      readonly unchangedRows: number;
    };

/** Field types a single typed/selected value can be applied to in bulk. */
export function isBulkEditable(field: FieldDefinition): boolean {
  return (
    isFieldEditable(field) &&
    !["user", "position", "link-to-record", "attachment"].includes(field.type)
  );
}

/** Plans "set field to value on every row in the current view". Rows already holding the value are skipped. */
export function planBulk(
  records: readonly RecordEnvelope[],
  field: FieldDefinition,
  raw: string,
): BulkPlan {
  const parsed = parseEditorInput(field, raw);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }
  const updates: PlannedUpdate[] = [];
  let unchangedRows = 0;
  for (const record of records) {
    if (same(parsed.value, record.values[field.key])) {
      unchangedRows += 1;
      continue;
    }
    updates.push({
      record,
      values: { [field.key]: parsed.value },
      previous: { [field.key]: record.values[field.key] ?? null },
    });
  }
  return { ok: true, updates, unchangedRows };
}

/** Converts planned updates into API inputs, each carrying the record's displayed base version. */
export function toUpdateInputs(
  tableId: string,
  updates: readonly PlannedUpdate[],
): UpdateRecordInput[] {
  return updates.map((u) => ({
    tableId,
    recordId: u.record.id,
    baseVersion: u.record.version,
    values: u.values,
  }));
}

/** What undo needs to reverse one confirmed update: the old values and the version the server assigned. */
export interface UndoEdit {
  readonly recordId: string;
  readonly previous: Readonly<Record<string, unknown>>;
  readonly versionAfter: number;
}

export interface UndoEntry {
  readonly label: string;
  readonly edits: readonly UndoEdit[];
}

export const UNDO_LIMIT = 20;

/** Pushes an entry, keeping only the most recent UNDO_LIMIT. */
export function pushUndo(stack: readonly UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, entry].slice(-UNDO_LIMIT);
}

/** Splits an array into fixed-size chunks (batches are sent in order, 200 at a time). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
