import type { PageDefinition } from "@argus/schema";
import {
  commit,
  createHistory,
  type History,
  type LayoutBreakpoint,
  redo,
  stableStringify,
  undo,
} from "../boards/index.js";

/** Edits with the same key inside this window collapse into one undo step (typing in a field). */
export const COALESCE_WINDOW_MS = 1_000;

/**
 * Builder state over a whole PageDefinition (blocks, layouts and page settings share one undo
 * history). Mirrors the board builder reducer, which is keyed on BoardBundle.
 */
export interface PageBuilderState {
  readonly history: History<PageDefinition>;
  readonly lastKey: string | null;
  readonly lastAt: number;
  readonly savedPage: PageDefinition;
  /** Version the draft was loaded from / last saved as (optimistic base for saveDraft). */
  readonly baseVersion: number;
  readonly selectedId: string | null;
  readonly selectedIds: readonly string[];
  readonly breakpoint: LayoutBreakpoint;
  /** Polite live-region message describing the last action. */
  readonly announcement: string;
}

export type PageBuilderAction =
  | {
      readonly type: "edit";
      readonly next: PageDefinition;
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
  | { readonly type: "saved"; readonly version: number; readonly page: PageDefinition };

export function createPageBuilderState(page: PageDefinition): PageBuilderState {
  return {
    history: createHistory(page),
    lastKey: null,
    lastAt: 0,
    savedPage: page,
    baseVersion: page.version,
    selectedId: null,
    selectedIds: [],
    breakpoint: "desktop",
    announcement: "",
  };
}

export function isSamePage(a: PageDefinition, b: PageDefinition): boolean {
  return a === b || stableStringify(a) === stableStringify(b);
}

export function isPageDirty(state: PageBuilderState): boolean {
  return !isSamePage(state.history.present, state.savedPage);
}

export const canUndoPage = (state: PageBuilderState): boolean => state.history.past.length > 0;
export const canRedoPage = (state: PageBuilderState): boolean => state.history.future.length > 0;

export function pageBuilderReducer(
  state: PageBuilderState,
  action: PageBuilderAction,
): PageBuilderState {
  switch (action.type) {
    case "edit": {
      if (isSamePage(action.next, state.history.present)) return state;
      const key = action.key ?? null;
      const coalesce =
        key !== null && key === state.lastKey && action.at - state.lastAt < COALESCE_WINDOW_MS;
      const history = coalesce
        ? { ...state.history, present: action.next, future: [] }
        : commit(state.history, action.next);
      const existing = new Set(action.next.blocks.map((block) => block.id));
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
        : {
            ...pruneSelection(state, history.present),
            history,
            lastKey: null,
            announcement: "Undid last change.",
          };
    }
    case "redo": {
      const history = redo(state.history);
      return history === state.history
        ? state
        : {
            ...pruneSelection(state, history.present),
            history,
            lastKey: null,
            announcement: "Redid change.",
          };
    }
    case "select": {
      if (action.id === null) return { ...state, selectedId: null, selectedIds: [] };
      if (!action.toggle) return { ...state, selectedId: action.id, selectedIds: [action.id] };
      const id = action.id;
      const selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id];
      return { ...state, selectedIds, selectedId: selectedIds.at(-1) ?? null };
    }
    case "select-many":
      return { ...state, selectedIds: action.ids, selectedId: action.ids.at(-1) ?? null };
    case "announce":
      return { ...state, announcement: action.message };
    case "breakpoint":
      return { ...state, breakpoint: action.value };
    case "saved":
      return {
        ...state,
        savedPage: action.page,
        baseVersion: action.version,
        announcement: `Draft saved as version ${action.version}.`,
      };
  }
}

function pruneSelection(state: PageBuilderState, page: PageDefinition): PageBuilderState {
  const existing = new Set(page.blocks.map((block) => block.id));
  const selectedIds = state.selectedIds.filter((id) => existing.has(id));
  const selectedId =
    state.selectedId !== null && existing.has(state.selectedId)
      ? state.selectedId
      : (selectedIds.at(-1) ?? null);
  return { ...state, selectedIds, selectedId };
}
