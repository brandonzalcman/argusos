import { isSameBundle } from "./draft.js";
import { commit, createHistory, type History, redo, undo } from "./history.js";
import type { BoardBundle, LayoutBreakpoint } from "./model.js";

/** Edits with the same key within this window collapse into one undo step (typing in a field). */
export const COALESCE_WINDOW_MS = 1_000;

export interface BuilderState {
  readonly history: History<BoardBundle>;
  readonly lastKey: string | null;
  readonly lastAt: number;
  readonly savedBundle: BoardBundle;
  /** Definition version the draft was loaded from / last saved as (optimistic base). */
  readonly baseVersion: number;
  /** Primary selection: the block the inspector edits (last one picked). */
  readonly selectedId: string | null;
  /** All selected blocks (multi-select); always contains `selectedId` when it is set. */
  readonly selectedIds: readonly string[];
  readonly breakpoint: LayoutBreakpoint;
  /** Polite live-region message describing the last keyboard/pointer action. */
  readonly announcement: string;
}

export type BuilderAction =
  | {
      readonly type: "edit";
      readonly next: BoardBundle;
      readonly at: number;
      readonly key?: string;
      readonly announce?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "select"; readonly id: string | null; readonly toggle?: boolean }
  | { readonly type: "select-many"; readonly ids: readonly string[] }
  | { readonly type: "announce"; readonly message: string }
  | { readonly type: "breakpoint"; readonly value: LayoutBreakpoint }
  | { readonly type: "saved"; readonly version: number; readonly bundle: BoardBundle };

export function createBuilderState(bundle: BoardBundle): BuilderState {
  return {
    history: createHistory(bundle),
    lastKey: null,
    lastAt: 0,
    savedBundle: bundle,
    baseVersion: bundle.definition.version,
    selectedId: null,
    selectedIds: [],
    breakpoint: "desktop",
    announcement: "",
  };
}

export function isDirty(state: BuilderState): boolean {
  return !isSameBundle(state.history.present, state.savedBundle);
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "edit": {
      if (isSameBundle(action.next, state.history.present)) return state;
      const key = action.key ?? null;
      const coalesce =
        key !== null && key === state.lastKey && action.at - state.lastAt < COALESCE_WINDOW_MS;
      const history = coalesce
        ? { ...state.history, present: action.next, future: [] }
        : commit(state.history, action.next);
      const existing = new Set(action.next.definition.blocks.map((b) => b.id));
      const selectedIds = state.selectedIds.filter((id) => existing.has(id));
      const selectedId =
        state.selectedId !== null && existing.has(state.selectedId)
          ? state.selectedId
          : (selectedIds.at(-1) ?? null);
      return {
        ...state,
        history,
        lastKey: key,
        lastAt: action.at,
        selectedId,
        selectedIds,
        announcement: action.announce ?? state.announcement,
      };
    }
    case "undo": {
      const history = undo(state.history);
      return history === state.history
        ? state
        : { ...state, history, lastKey: null, announcement: "Undid last change." };
    }
    case "redo": {
      const history = redo(state.history);
      return history === state.history
        ? state
        : { ...state, history, lastKey: null, announcement: "Redid change." };
    }
    case "select": {
      if (action.id === null) {
        return { ...state, selectedId: null, selectedIds: [] };
      }
      if (!action.toggle) {
        return { ...state, selectedId: action.id, selectedIds: [action.id] };
      }
      const id = action.id;
      const selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id];
      return { ...state, selectedIds, selectedId: selectedIds.at(-1) ?? null };
    }
    case "announce":
      return { ...state, announcement: action.message };
    case "select-many":
      return { ...state, selectedIds: action.ids, selectedId: action.ids.at(-1) ?? null };
    case "breakpoint":
      return { ...state, breakpoint: action.value };
    case "saved":
      return {
        ...state,
        savedBundle: action.bundle,
        baseVersion: action.version,
        announcement: `Draft saved as version ${action.version}.`,
      };
  }
}
