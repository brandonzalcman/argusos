import type { MigrationExecutionResult, MigrationPreview } from "@argus/ddl-engine";
import type {
  FieldDefinition,
  RecordEnvelope,
  RecordFieldConflict,
  TableDefinition,
  UpdateRecordInput,
  ViewDefinition,
} from "@argus/schema";
import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import type { ElectricSyncSnapshot } from "../../services/electric-sync.js";

/** Returned by every subscription so React effects can always clean up. */
export type Unsubscribe = () => void;

/** Shared freshness information. Mirrors the Electric sync state so the UI can always say how current it is. */
export type SyncInfo = ElectricSyncSnapshot;

/** Events for a single live value (catalog, one table definition, saved views). */
export type LiveValueEvent<T> =
  | { readonly kind: "value"; readonly value: T; readonly sync: SyncInfo }
  | { readonly kind: "sync"; readonly sync: SyncInfo }
  | { readonly kind: "error"; readonly error: Error };

/** Events for a live row set. `changes` carry only rows the caller is authorized to read. */
export type LiveRowsEvent =
  | { readonly kind: "snapshot"; readonly rows: readonly RecordEnvelope[]; readonly sync: SyncInfo }
  | {
      readonly kind: "changes";
      readonly upserts: readonly RecordEnvelope[];
      readonly deletedIds: readonly string[];
      readonly sync: SyncInfo;
    }
  | { readonly kind: "sync"; readonly sync: SyncInfo }
  | { readonly kind: "error"; readonly error: Error };

export type LiveListener<E> = (event: E) => void;

/**
 * Outcome of an optimistic field edit.
 * - `committed`: server accepted the patch against `baseVersion`; the new envelope is authoritative.
 * - `queued`: offline; the adapter stored an OfflineMutation (see OfflineMutationQueuePort.enqueue).
 * - `conflict`: same-field conflict or stale base version; nothing was overwritten.
 */
export type UpdateRecordResult =
  | { readonly status: "committed"; readonly record: RecordEnvelope }
  | { readonly status: "queued"; readonly mutationId: string }
  | {
      readonly status: "conflict";
      readonly currentVersion: number;
      readonly conflicts: readonly RecordFieldConflict[];
    };

/** Grid view state persisted by saved views. Mirrors the persisted ViewDefinition fields. */
export interface SaveViewRequest {
  readonly tableId: string;
  readonly name: string;
  /** Present when updating an existing view; the API compares it for optimistic concurrency. */
  readonly existing: { readonly viewId: string; readonly expectedVersion: number } | null;
  readonly state: {
    readonly filters: ViewDefinition["filters"];
    readonly sorts: readonly ViewDefinition["sorts"][number][];
    readonly grouping: ViewDefinition["grouping"];
    readonly fieldOrder: readonly string[];
    readonly hiddenFieldIds: readonly string[];
  };
}

/** What a lookup editor can search. Server-side search is authorized per field and incident. */
export type LookupKind = "user" | "position" | "link";

export interface LookupOption {
  readonly id: string;
  readonly label: string;
  readonly detail?: string | undefined;
}

export interface LookupSearchRequest {
  readonly tableId: string;
  readonly fieldId: string;
  readonly kind: LookupKind;
  readonly query: string;
  readonly limit: number;
}

/** Stored value of an attachment field element. */
export interface AttachmentValue {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly contentType: string;
}

export interface UploadAttachmentRequest {
  readonly tableId: string;
  readonly recordId: string;
  readonly fieldId: string;
  readonly file: File;
}

/** Structured draft sent to the DDL engine planner. Never contains SQL. */
export interface MigrationDraftRequest {
  readonly tableId: string;
  readonly expectedLiveVersion: number;
  readonly fields: readonly FieldDefinition[];
}

export interface ApplyMigrationRequest {
  readonly tableId: string;
  readonly planId: string;
  /** Binds approval to the exact plan the operator reviewed. */
  readonly planDigest: string;
  readonly expectedLiveVersion: number;
  /** Operation ids of every destructive change the operator confirmed by typing the table name. */
  readonly acknowledgedDestructiveOperationIds: readonly string[];
}

/**
 * The only data boundary of the tables feature. Production adapters are built on ElectricSyncPort
 * (row shapes), OfflineMutationQueuePort (writes) and the tRPC app API (catalog, views, DDL plans).
 * Every method is tenant/incident scoped by the adapter; callers never pass tenant identifiers.
 */
export interface TablesDataPort {
  readonly subscribeCatalog: (
    listener: LiveListener<LiveValueEvent<readonly TableDefinition[]>>,
  ) => Unsubscribe;
  /** `null` value means the table does not exist or the position may not read it (indistinguishable by design). */
  readonly subscribeTable: (
    tableId: string,
    listener: LiveListener<LiveValueEvent<TableDefinition | null>>,
  ) => Unsubscribe;
  readonly subscribeRows: (tableId: string, listener: LiveListener<LiveRowsEvent>) => Unsubscribe;
  readonly subscribeViews: (
    tableId: string,
    listener: LiveListener<LiveValueEvent<readonly ViewDefinition[]>>,
  ) => Unsubscribe;
  readonly updateRecord: (input: UpdateRecordInput) => Promise<UpdateRecordResult>;
  /**
   * Batch of optimistic updates (paste, bulk edit, undo). Results align with inputs by index; each input is
   * checked against its own baseVersion, so one stale row never overwrites or blocks the others.
   */
  readonly updateRecords: (
    inputs: readonly UpdateRecordInput[],
  ) => Promise<readonly UpdateRecordResult[]>;
  /** Authorized option search for user, position and link-to-record editors. */
  readonly searchLookupOptions: (request: LookupSearchRequest) => Promise<readonly LookupOption[]>;
  /** Uploads to object storage via the API and returns the stored attachment descriptor. */
  readonly uploadAttachment: (request: UploadAttachmentRequest) => Promise<AttachmentValue>;
  readonly saveView: (request: SaveViewRequest) => Promise<ViewDefinition>;
  readonly previewMigration: (request: MigrationDraftRequest) => Promise<MigrationPreview>;
  readonly applyMigration: (request: ApplyMigrationRequest) => Promise<MigrationExecutionResult>;
}

function notConnected(method: string): Error {
  return new Error(`TODO(implementation): TablesDataPort.${method} is not connected`);
}

function failAsync<E extends { readonly kind: string }>(
  method: string,
  listener: LiveListener<E>,
): Unsubscribe {
  let active = true;
  queueMicrotask(() => {
    if (active) {
      listener({ kind: "error", error: notConnected(method) } as unknown as E);
    }
  });
  return () => {
    active = false;
  };
}

/**
 * TODO(implementation): replace with an adapter over Electric shapes, the offline mutation queue and the app API.
 * Input: none. Output: a port whose subscriptions emit an explicit error event and whose writes reject.
 * Errors: every operation reports TODO(implementation); no table, row, view or plan is fabricated.
 * Depends on: apps/api catalog + DDL endpoints, ElectricSQL shapes, RLS, and offline-mutations.
 */
export function createDisconnectedTablesDataPort(): TablesDataPort {
  return {
    subscribeCatalog: (listener) => failAsync("subscribeCatalog", listener),
    subscribeTable: (_id, listener) => failAsync("subscribeTable", listener),
    subscribeRows: (_id, listener) => failAsync("subscribeRows", listener),
    subscribeViews: (_id, listener) => failAsync("subscribeViews", listener),
    updateRecord: () => Promise.reject(notConnected("updateRecord")),
    updateRecords: () => Promise.reject(notConnected("updateRecords")),
    searchLookupOptions: () => Promise.reject(notConnected("searchLookupOptions")),
    uploadAttachment: () => Promise.reject(notConnected("uploadAttachment")),
    saveView: () => Promise.reject(notConnected("saveView")),
    previewMigration: () => Promise.reject(notConnected("previewMigration")),
    applyMigration: () => Promise.reject(notConnected("applyMigration")),
  };
}

const fallbackPort = createDisconnectedTablesDataPort();
const TablesDataContext = createContext<TablesDataPort>(fallbackPort);

export interface TablesDataProviderProps {
  readonly port: TablesDataPort;
  readonly children: ReactNode;
}

/** Supplies a connected port (or a test double). Without a provider the honest disconnected port is used. */
export function TablesDataProvider({ port, children }: TablesDataProviderProps): ReactElement {
  return <TablesDataContext.Provider value={port}>{children}</TablesDataContext.Provider>;
}

export function useTablesData(): TablesDataPort {
  return useContext(TablesDataContext);
}
