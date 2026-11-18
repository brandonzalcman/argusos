import type { RecordEnvelope, TableDefinition, ViewDefinition } from "@argus/schema";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  initialLiveRowsState,
  type LiveRowsAction,
  type LiveRowsState,
  liveRowsReducer,
} from "./live-rows.js";
import {
  type LiveListener,
  type LiveRowsEvent,
  type LiveValueEvent,
  type SyncInfo,
  type Unsubscribe,
  useTablesData,
} from "./tables-port.js";

export type LiveStatus = "loading" | "ready" | "error";

export interface LiveValue<T> {
  readonly status: LiveStatus;
  readonly value: T | undefined;
  readonly sync: SyncInfo | undefined;
  readonly error: Error | undefined;
  readonly retry: () => void;
}

/** Subscribes to a single live value and exposes loading / ready / error with a retry. */
function useLiveValue<T>(
  subscribe: (listener: LiveListener<LiveValueEvent<T>>) => Unsubscribe,
  key: string,
): LiveValue<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<LiveValue<T>, "retry">>({
    status: "loading",
    value: undefined,
    sync: undefined,
    error: undefined,
  });
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;

  useEffect(() => {
    setState({ status: "loading", value: undefined, sync: undefined, error: undefined });
    return subscribeRef.current((event) => {
      setState((prev) => {
        switch (event.kind) {
          case "value":
            return { status: "ready", value: event.value, sync: event.sync, error: undefined };
          case "sync":
            return { ...prev, sync: event.sync };
          case "error":
            return { status: "error", value: undefined, sync: prev.sync, error: event.error };
        }
      });
    });
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

export function useTableCatalog(): LiveValue<readonly TableDefinition[]> {
  const port = useTablesData();
  return useLiveValue((l) => port.subscribeCatalog(l), "catalog");
}

export function useTableDefinition(tableId: string): LiveValue<TableDefinition | null> {
  const port = useTablesData();
  return useLiveValue((l) => port.subscribeTable(tableId, l), `table:${tableId}`);
}

export function useSavedViews(tableId: string): LiveValue<readonly ViewDefinition[]> {
  const port = useTablesData();
  return useLiveValue((l) => port.subscribeViews(tableId, l), `views:${tableId}`);
}

export interface LiveRows {
  readonly status: LiveStatus;
  readonly sync: SyncInfo | undefined;
  readonly error: Error | undefined;
  readonly state: LiveRowsState;
  readonly pendingCount: number;
  readonly revealPending: () => void;
  readonly commitLocal: (record: RecordEnvelope) => void;
  readonly retry: () => void;
}

/** Live row set for one table: snapshot + WAL-ordered changes, buffering inserts behind "N new rows". */
export function useLiveRows(tableId: string): LiveRows {
  const port = useTablesData();
  const [attempt, setAttempt] = useState(0);
  const [state, dispatch] = useReducer(
    (s: LiveRowsState, a: LiveRowsAction) => liveRowsReducer(s, a),
    initialLiveRowsState,
  );
  const [meta, setMeta] = useState<{
    status: LiveStatus;
    sync: SyncInfo | undefined;
    error: Error | undefined;
  }>({ status: "loading", sync: undefined, error: undefined });

  useEffect(() => {
    dispatch({ type: "reset" });
    setMeta({ status: "loading", sync: undefined, error: undefined });
    const onEvent = (event: LiveRowsEvent): void => {
      switch (event.kind) {
        case "snapshot":
          dispatch({ type: "snapshot", rows: event.rows });
          setMeta({ status: "ready", sync: event.sync, error: undefined });
          break;
        case "changes":
          dispatch({ type: "changes", upserts: event.upserts, deletedIds: event.deletedIds });
          setMeta((m) => ({ ...m, sync: event.sync }));
          break;
        case "sync":
          setMeta((m) => ({ ...m, sync: event.sync }));
          break;
        case "error":
          setMeta((m) => ({ status: "error", sync: m.sync, error: event.error }));
          break;
      }
    };
    return port.subscribeRows(tableId, onEvent);
  }, [port, tableId, attempt]);

  return {
    ...meta,
    state,
    pendingCount: state.pending.size,
    revealPending: useCallback(() => dispatch({ type: "reveal" }), []),
    commitLocal: useCallback((record) => dispatch({ type: "local-commit", record }), []),
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
