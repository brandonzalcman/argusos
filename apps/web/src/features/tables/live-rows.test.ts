import { describe, expect, it } from "vitest";
import { initialLiveRowsState, liveRowsReducer } from "./live-rows.js";
import { fixtureRecord } from "./test-fixtures.js";

describe("live-rows reducer (test fixtures)", () => {
  const a = fixtureRecord(1, { title: "A" });
  const loaded = liveRowsReducer(initialLiveRowsState, { type: "snapshot", rows: [a] });

  it("loads the first snapshot without flashing or buffering", () => {
    expect(loaded.rows.size).toBe(1);
    expect(loaded.pending.size).toBe(0);
    expect(loaded.flashes.size).toBe(0);
  });

  it("flashes visible rows on a newer version and ignores stale versions", () => {
    const updated = liveRowsReducer(loaded, {
      type: "changes",
      upserts: [{ ...a, version: 2, values: { title: "A2" } }],
      deletedIds: [],
    });
    expect(updated.rows.get(a.id)?.values.title).toBe("A2");
    expect(updated.flashes.has(a.id)).toBe(true);
    const stale = liveRowsReducer(updated, { type: "changes", upserts: [a], deletedIds: [] });
    expect(stale.rows.get(a.id)?.version).toBe(2);
  });

  it("buffers inserts behind the new-rows pill until revealed", () => {
    const b = fixtureRecord(2, { title: "B" });
    const buffered = liveRowsReducer(loaded, { type: "changes", upserts: [b], deletedIds: [] });
    expect(buffered.rows.size).toBe(1);
    expect(buffered.pending.size).toBe(1);
    const revealed = liveRowsReducer(buffered, { type: "reveal" });
    expect(revealed.rows.size).toBe(2);
    expect(revealed.pending.size).toBe(0);
  });

  it("removes deleted and soft-deleted rows", () => {
    const removed = liveRowsReducer(loaded, { type: "changes", upserts: [], deletedIds: [a.id] });
    expect(removed.rows.size).toBe(0);
    const soft = liveRowsReducer(loaded, {
      type: "changes",
      upserts: [{ ...a, version: 2, deletedAt: "2026-01-02T00:00:00Z" }],
      deletedIds: [],
    });
    expect(soft.rows.size).toBe(0);
  });

  it("treats a re-sync snapshot as a diff", () => {
    const b = fixtureRecord(2, { title: "B" });
    const resync = liveRowsReducer(loaded, { type: "snapshot", rows: [{ ...a, version: 3 }, b] });
    expect(resync.rows.get(a.id)?.version).toBe(3);
    expect(resync.pending.has(b.id)).toBe(true);
  });
});
