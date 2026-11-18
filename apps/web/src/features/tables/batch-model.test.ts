import { describe, expect, it } from "vitest";
import {
  chunk,
  isBulkEditable,
  type PastedCell,
  planBulk,
  planPaste,
  pushUndo,
  toUpdateInputs,
  UNDO_LIMIT,
} from "./batch-model.js";
import { filterRecords } from "./grid-model.js";
import {
  fixtureCount,
  fixtureFields,
  fixtureRecord,
  fixtureStatus,
  fixtureTitle,
} from "./test-fixtures.js";

const a = fixtureRecord(1, { title: "Alpha", count: 5, state: "opt-open" }, 3);
const b = fixtureRecord(2, { title: "Bravo", count: 7, state: "opt-done" }, 1);

describe("batch-model (test fixtures)", () => {
  it("plans a paste: parses, skips no-ops and reports invalid cells", () => {
    const cells: PastedCell[] = [
      { record: a, field: fixtureCount, raw: "9" },
      { record: a, field: fixtureTitle, raw: "Alpha" },
      { record: b, field: fixtureCount, raw: "abc" },
      { record: b, field: fixtureStatus, raw: "Open" },
    ];
    const plan = planPaste(cells, 2);
    expect(plan.changedCells).toBe(2);
    expect(plan.unchangedCells).toBe(1);
    expect(plan.issues).toHaveLength(1);
    expect(plan.overflowRows).toBe(2);
    expect(plan.updates.find((u) => u.record.id === a.id)?.previous).toEqual({ count: 5 });
    expect(plan.updates.find((u) => u.record.id === b.id)?.values).toEqual({ state: "opt-open" });
  });

  it("sends each row's displayed baseVersion", () => {
    const plan = planPaste([{ record: a, field: fixtureCount, raw: "9" }], 0);
    expect(toUpdateInputs("t", plan.updates)).toEqual([
      { tableId: "t", recordId: a.id, baseVersion: 3, values: { count: 9 } },
    ]);
  });

  it("plans bulk edits and rejects invalid values", () => {
    const ok = planBulk([a, b], fixtureCount, "7");
    expect(ok.ok && ok.updates.map((u) => u.record.id)).toEqual([a.id]);
    expect(planBulk([a], fixtureCount, "nope").ok).toBe(false);
    expect(isBulkEditable(fixtureCount)).toBe(true);
  });

  it("keeps a bounded undo stack and chunks batches", () => {
    let stack = pushUndo([], { label: "0", edits: [] });
    for (let i = 1; i < UNDO_LIMIT + 5; i += 1) {
      stack = pushUndo(stack, { label: String(i), edits: [] });
    }
    expect(stack).toHaveLength(UNDO_LIMIT);
    expect(stack.at(-1)?.label).toBe(String(UNDO_LIMIT + 4));
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("evaluates nested filter groups", () => {
    const byId = new Map(fixtureFields.map((f) => [f.id, f]));
    const out = filterRecords(
      [a, b],
      {
        conjunction: "and",
        conditions: [{ fieldId: fixtureCount.id, operator: "greater-than", value: 1 }],
        groups: [
          {
            conjunction: "or",
            conditions: [
              { fieldId: fixtureTitle.id, operator: "equals", value: "alpha" },
              { fieldId: fixtureStatus.id, operator: "equals", value: "opt-done" },
            ],
            groups: [],
          },
        ],
      },
      byId,
    );
    expect(out.map((r) => r.id)).toEqual([a.id, b.id]);
  });
});
