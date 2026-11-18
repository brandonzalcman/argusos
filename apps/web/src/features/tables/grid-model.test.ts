import { describe, expect, it } from "vitest";
import {
  buildDisplayRows,
  filterRecords,
  formatCellValue,
  sortRecords,
  visibleFields,
} from "./grid-model.js";
import {
  fixtureCount,
  fixtureFields,
  fixtureRecord,
  fixtureStatus,
  fixtureTitle,
} from "./test-fixtures.js";

const byId = new Map(fixtureFields.map((f) => [f.id, f]));
const rows = [
  fixtureRecord(1, { title: "Alpha", count: 5, state: "opt-open" }),
  fixtureRecord(2, { title: "bravo", count: 20, state: "opt-done" }),
  fixtureRecord(3, { title: "Charlie", count: null, state: "opt-open" }),
];

describe("grid-model (test fixtures)", () => {
  it("filters with typed operators and AND/OR", () => {
    const run = (conjunction: "and" | "or") =>
      filterRecords(
        rows,
        {
          conjunction,
          groups: [],
          conditions: [
            { fieldId: fixtureCount.id, operator: "greater-than", value: 10 },
            { fieldId: fixtureTitle.id, operator: "starts-with", value: "a" },
          ],
        },
        byId,
      ).map((r) => r.values.title);
    expect(run("and")).toEqual([]);
    expect(run("or")).toEqual(["Alpha", "bravo"]);
  });

  it("treats empty and select values correctly", () => {
    const empty = filterRecords(
      rows,
      {
        conjunction: "and",
        groups: [],
        conditions: [{ fieldId: fixtureCount.id, operator: "is-empty", value: null }],
      },
      byId,
    );
    expect(empty).toHaveLength(1);
    const open = filterRecords(
      rows,
      {
        conjunction: "and",
        groups: [],
        conditions: [{ fieldId: fixtureStatus.id, operator: "equals", value: "opt-open" }],
      },
      byId,
    );
    expect(open).toHaveLength(2);
  });

  it("ignores conditions on fields the caller cannot see", () => {
    const out = filterRecords(
      rows,
      {
        conjunction: "and",
        groups: [],
        conditions: [{ fieldId: "missing", operator: "equals", value: "x" }],
      },
      byId,
    );
    expect(out).toHaveLength(3);
  });

  it("sorts numerically with nulls last, ascending and descending", () => {
    const asc = sortRecords(
      rows,
      [{ fieldId: fixtureCount.id, direction: "ascending", nulls: "last" }],
      byId,
    );
    expect(asc.map((r) => r.values.count)).toEqual([5, 20, null]);
    const desc = sortRecords(
      rows,
      [{ fieldId: fixtureCount.id, direction: "descending", nulls: "last" }],
      byId,
    );
    expect(desc.map((r) => r.values.count)).toEqual([20, 5, null]);
  });

  it("groups with collapse support", () => {
    const grouping = {
      fieldId: fixtureStatus.id,
      direction: "ascending",
      collapsed: false,
    } as const;
    const open = buildDisplayRows(rows, grouping, byId, new Set());
    const labels = open.flatMap((r) => (r.kind === "group" ? [r.label] : []));
    expect(labels).toEqual(["Done", "Open"]);
    expect(open).toHaveLength(5);
    const collapsed = buildDisplayRows(rows, grouping, byId, new Set([JSON.stringify("opt-open")]));
    expect(collapsed).toHaveLength(3);
  });

  it("hides fields and honours saved order", () => {
    const out = visibleFields(fixtureFields, {
      hiddenFieldIds: [fixtureCount.id],
      fieldOrder: [fixtureStatus.id],
    });
    expect(out.map((f) => f.key)).toEqual(["state", "title"]);
  });

  it("formats select labels and empty values", () => {
    expect(formatCellValue(fixtureStatus, "opt-done")).toBe("Done");
    expect(formatCellValue(fixtureCount, null)).toBe("");
  });

  it("sorts 50k rows within a generous budget", () => {
    const many = Array.from({ length: 50_000 }, (_, i) =>
      fixtureRecord(i, { title: `t${(i * 7919) % 50_000}`, count: (i * 31) % 997 }),
    );
    const start = performance.now();
    sortRecords(many, [{ fieldId: fixtureCount.id, direction: "ascending", nulls: "last" }], byId);
    expect(performance.now() - start).toBeLessThan(2_000);
  });
});
