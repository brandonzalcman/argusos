import type { MigrationExecutionResult } from "@argus/ddl-engine";
import type { RecordEnvelope, TableDefinition, ViewDefinition } from "@argus/schema";
import type {
  ApplyMigrationRequest,
  LiveListener,
  LiveRowsEvent,
  LiveValueEvent,
  MigrationDraftRequest,
  SaveViewRequest,
  TablesDataPort,
  UpdateRecordResult,
} from "../../features/tables/tables-port.js";
import type { ElectricSyncSnapshot } from "../../services/electric-sync.js";
import {
  DEMO_ACTOR,
  DEMO_POSITIONS,
  DEMO_TENANT_ID,
  DEMO_USERS,
  demoDelay,
  demoId,
} from "../scenario.js";
import { createDemoRows, createDemoTables, createDemoViews } from "./definitions.js";
import { buildDemoPlan, type DemoPlanRecord, isoNow } from "./migration.js";

const SUBSCRIBE_DELAY_MS = 200;

function liveSync(): ElectricSyncSnapshot {
  return {
    state: "live",
    lastVisibleCommitAt: new Date().toISOString(),
    detail: "Demo mode: in-memory data, nothing is saved to a server.",
  };
}

/** A tiny listener set with an async first emission and a cleanup that stops pending delivery. */
class Channel<E> {
  private readonly listeners = new Set<LiveListener<E>>();

  subscribe(listener: LiveListener<E>, initial: () => E): () => void {
    let active = true;
    const wrapped: LiveListener<E> = (event) => {
      if (active) {
        listener(event);
      }
    };
    this.listeners.add(wrapped);
    const timer = setTimeout(() => wrapped(initial()), SUBSCRIBE_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      this.listeners.delete(wrapped);
    };
  }

  emit(event: E): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}

/**
 * In-memory TablesDataPort for demo mode. State lives per page load; edits, saved views and schema
 * changes update that state and notify live subscribers so the UI reacts exactly as it would to
 * ElectricSQL changes. No SQL is generated anywhere.
 */
export function createDemoTablesDataPort(): TablesDataPort {
  const tables = new Map<string, TableDefinition>(createDemoTables().map((t) => [t.id, t]));
  const rows = createDemoRows();
  const views = createDemoViews();
  const plans = new Map<string, DemoPlanRecord>();

  const catalogChannel = new Channel<LiveValueEvent<readonly TableDefinition[]>>();
  const tableChannels = new Map<string, Channel<LiveValueEvent<TableDefinition | null>>>();
  const rowChannels = new Map<string, Channel<LiveRowsEvent>>();
  const viewChannels = new Map<string, Channel<LiveValueEvent<readonly ViewDefinition[]>>>();

  const channelFor = <E>(map: Map<string, Channel<E>>, id: string): Channel<E> => {
    let channel = map.get(id);
    if (!channel) {
      channel = new Channel<E>();
      map.set(id, channel);
    }
    return channel;
  };

  const catalog = (): readonly TableDefinition[] => [...tables.values()];
  const viewsOf = (tableId: string): readonly ViewDefinition[] => [...(views.get(tableId) ?? [])];

  return {
    subscribeCatalog: (listener) =>
      catalogChannel.subscribe(listener, () => ({
        kind: "value",
        value: catalog(),
        sync: liveSync(),
      })),

    subscribeTable: (tableId, listener) =>
      channelFor(tableChannels, tableId).subscribe(listener, () => ({
        kind: "value",
        value: tables.get(tableId) ?? null,
        sync: liveSync(),
      })),

    subscribeRows: (tableId, listener) =>
      channelFor(rowChannels, tableId).subscribe(listener, () => ({
        kind: "snapshot",
        rows: [...(rows.get(tableId) ?? [])],
        sync: liveSync(),
      })),

    subscribeViews: (tableId, listener) =>
      channelFor(viewChannels, tableId).subscribe(listener, () => ({
        kind: "value",
        value: viewsOf(tableId),
        sync: liveSync(),
      })),

    updateRecord: async (input): Promise<UpdateRecordResult> => {
      const table = tables.get(input.tableId);
      const tableRows = rows.get(input.tableId);
      const index = tableRows?.findIndex((r) => r.id === input.recordId) ?? -1;
      const current = tableRows?.[index];
      if (!table || !tableRows || !current) {
        throw new Error("That record no longer exists.");
      }
      const keys = Object.keys(input.values);
      const fieldsByKey = new Map(table.fields.map((f) => [f.key, f]));
      for (const key of keys) {
        if (!fieldsByKey.has(key)) {
          throw new Error(`Unknown field "${key}".`);
        }
      }

      if (input.baseVersion !== current.version) {
        const conflicts = keys.flatMap((key) => {
          const f = fieldsByKey.get(key);
          const incoming = input.values[key];
          const currentValue = current.values[key] ?? null;
          return f && currentValue !== incoming
            ? [
                {
                  fieldId: f.id,
                  baseValue: null,
                  incomingValue: incoming,
                  currentValue,
                  currentVersion: current.version,
                },
              ]
            : [];
        });
        if (conflicts.length > 0) {
          return await demoDelay({
            status: "conflict",
            currentVersion: current.version,
            conflicts,
          });
        }
      }

      const updated: RecordEnvelope = {
        ...current,
        values: { ...current.values, ...input.values },
        updatedAt: new Date().toISOString(),
        updatedBy: DEMO_ACTOR.userId ?? DEMO_USERS.alexMorgan,
        updatedPositionId: DEMO_ACTOR.positionId ?? DEMO_POSITIONS.incidentCommander,
        version: current.version + 1,
      };
      tableRows[index] = updated;
      const result = await demoDelay<UpdateRecordResult>(
        { status: "committed", record: updated },
        150,
      );
      channelFor(rowChannels, input.tableId).emit({
        kind: "changes",
        upserts: [updated],
        deletedIds: [],
        sync: liveSync(),
      });
      return result;
    },

    saveView: async (request: SaveViewRequest): Promise<ViewDefinition> => {
      const list = views.get(request.tableId) ?? [];
      const now = new Date().toISOString();
      let saved: ViewDefinition;
      if (request.existing) {
        const { viewId, expectedVersion } = request.existing;
        const index = list.findIndex((v) => v.id === viewId);
        const current = list[index];
        if (!current) {
          throw new Error("That view no longer exists.");
        }
        if (current.version !== expectedVersion) {
          throw new Error(
            `The view was changed elsewhere (now v${current.version}). Reload and try again.`,
          );
        }
        saved = {
          ...current,
          filters: request.state.filters,
          sorts: [...request.state.sorts],
          grouping: request.state.grouping,
          fieldOrder: [...request.state.fieldOrder],
          hiddenFieldIds: [...request.state.hiddenFieldIds],
          name: request.name,
          version: current.version + 1,
        };
        list[index] = saved;
      } else {
        saved = {
          id: demoId(),
          tenantId: DEMO_TENANT_ID,
          version: 1,
          lifecycle: "published",
          changeSummary: null,
          createdAt: now,
          createdBy: DEMO_USERS.alexMorgan,
          createdPositionId: DEMO_POSITIONS.incidentCommander,
          publishedAt: now,
          publishedBy: DEMO_USERS.alexMorgan,
          tableId: request.tableId,
          name: request.name,
          kind: "grid",
          colorRules: [],
          access: { positionIds: [], visibilityRule: null },
          publicForm: false,
          fieldOrder: [...request.state.fieldOrder],
          hiddenFieldIds: [...request.state.hiddenFieldIds],
          sorts: [...request.state.sorts],
          filters: request.state.filters,
          grouping: request.state.grouping,
        };
        list.push(saved);
      }
      views.set(request.tableId, list);
      const result = await demoDelay(saved, 200);
      channelFor(viewChannels, request.tableId).emit({
        kind: "value",
        value: viewsOf(request.tableId),
        sync: liveSync(),
      });
      return result;
    },

    previewMigration: async (request: MigrationDraftRequest) => {
      const table = tables.get(request.tableId);
      if (!table) {
        throw new Error("That table does not exist.");
      }
      if (request.expectedLiveVersion !== table.version) {
        throw new Error(
          `The table is now at version ${table.version}; preview again against the current version.`,
        );
      }
      const { preview, record } = buildDemoPlan(table, request.fields, rows.get(table.id) ?? []);
      plans.set(preview.plan.planId, record);
      return await demoDelay(preview, 400);
    },

    applyMigration: async (request: ApplyMigrationRequest): Promise<MigrationExecutionResult> => {
      const table = tables.get(request.tableId);
      const record = plans.get(request.planId);
      if (!table || !record) {
        throw new Error("That plan is no longer available. Preview the change again.");
      }
      if (record.plan.planDigest !== request.planDigest) {
        throw new Error("The plan changed after it was reviewed. Preview the change again.");
      }
      if (request.expectedLiveVersion !== table.version) {
        throw new Error(
          `The table is now at version ${table.version}; preview again against the current version.`,
        );
      }
      const acknowledged = new Set(request.acknowledgedDestructiveOperationIds);
      if (!record.destructiveOperationIds.every((id) => acknowledged.has(id))) {
        throw new Error("Every destructive change must be acknowledged before publishing.");
      }

      const now = new Date().toISOString();
      const next: TableDefinition = {
        ...table,
        fields: [...record.draftFields],
        version: table.version + 1,
        publishedAt: now,
        publishedBy: DEMO_USERS.alexMorgan,
        changeSummary: "Demo schema change (in-memory).",
      };
      tables.set(table.id, next);
      plans.delete(request.planId);
      const result = await demoDelay(
        {
          planId: record.plan.planId,
          transactionId: demoId() as MigrationExecutionResult["transactionId"],
          publicationId: demoId() as MigrationExecutionResult["publicationId"],
          publishedVersion: next.version,
          auditEventId: demoId() as MigrationExecutionResult["auditEventId"],
          committedAt: isoNow(),
        },
        500,
      );
      channelFor(tableChannels, table.id).emit({ kind: "value", value: next, sync: liveSync() });
      catalogChannel.emit({ kind: "value", value: catalog(), sync: liveSync() });
      return result;
    },
  };
}
