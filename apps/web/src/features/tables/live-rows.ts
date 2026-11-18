import type { RecordEnvelope } from "@argus/schema";

/**
 * Pure live-row store. Updates to visible rows apply immediately (and flash); rows that first appear
 * after the initial snapshot are buffered in `pending` so the list never shifts under the operator.
 */
export interface LiveRowsState {
  readonly loaded: boolean;
  readonly rows: ReadonlyMap<string, RecordEnvelope>;
  readonly pending: ReadonlyMap<string, RecordEnvelope>;
  /** record id -> flash sequence; the sequence parity alternates the CSS animation so repeats restart it. */
  readonly flashes: ReadonlyMap<string, number>;
  readonly flashSeq: number;
}

export type LiveRowsAction =
  | { readonly type: "snapshot"; readonly rows: readonly RecordEnvelope[] }
  | {
      readonly type: "changes";
      readonly upserts: readonly RecordEnvelope[];
      readonly deletedIds: readonly string[];
    }
  | { readonly type: "reveal" }
  | { readonly type: "local-commit"; readonly record: RecordEnvelope }
  | { readonly type: "reset" };

export const initialLiveRowsState: LiveRowsState = {
  loaded: false,
  rows: new Map(),
  pending: new Map(),
  flashes: new Map(),
  flashSeq: 0,
};

function applyChanges(
  state: LiveRowsState,
  upserts: readonly RecordEnvelope[],
  deletedIds: readonly string[],
  flash: boolean,
): LiveRowsState {
  const rows = new Map(state.rows);
  const pending = new Map(state.pending);
  const flashes = new Map(state.flashes);
  let seq = state.flashSeq;

  for (const id of deletedIds) {
    rows.delete(id);
    pending.delete(id);
    flashes.delete(id);
  }
  for (const record of upserts) {
    if (record.deletedAt !== null) {
      rows.delete(record.id);
      pending.delete(record.id);
      continue;
    }
    const current = rows.get(record.id);
    if (current) {
      // Optimistic versioning: never let an older envelope overwrite a newer one.
      if (record.version < current.version) {
        continue;
      }
      rows.set(record.id, record);
      if (flash && record.version > current.version) {
        seq += 1;
        flashes.set(record.id, seq);
      }
    } else {
      const buffered = pending.get(record.id);
      if (!buffered || record.version >= buffered.version) {
        pending.set(record.id, record);
      }
    }
  }
  return { loaded: true, rows, pending, flashes, flashSeq: seq };
}

export function liveRowsReducer(state: LiveRowsState, action: LiveRowsAction): LiveRowsState {
  switch (action.type) {
    case "reset":
      return initialLiveRowsState;
    case "snapshot": {
      if (!state.loaded) {
        return {
          loaded: true,
          rows: new Map(action.rows.filter((r) => r.deletedAt === null).map((r) => [r.id, r])),
          pending: new Map(),
          flashes: new Map(),
          flashSeq: 0,
        };
      }
      // Re-sync after reconnect: treat as a diff so edits flash and inserts stay behind the pill.
      const incoming = new Set(action.rows.map((r) => r.id));
      const missing = [...state.rows.keys(), ...state.pending.keys()].filter(
        (id) => !incoming.has(id),
      );
      return applyChanges(state, action.rows, missing, true);
    }
    case "changes":
      return applyChanges(state, action.upserts, action.deletedIds, true);
    case "local-commit": {
      if (!state.rows.has(action.record.id)) {
        return state;
      }
      return applyChanges(state, [action.record], [], false);
    }
    case "reveal": {
      if (state.pending.size === 0) {
        return state;
      }
      const rows = new Map(state.rows);
      for (const [id, record] of state.pending) {
        rows.set(id, record);
      }
      return { ...state, rows, pending: new Map() };
    }
  }
}
