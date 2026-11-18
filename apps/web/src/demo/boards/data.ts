import type { BoardDataPort } from "@argus/blocks";
import type { RecordEnvelope } from "@argus/schema";
import { DEMO_TENANT_ID, demoDelay, demoId } from "../scenario.js";
import { applyDemoView, createDemoRows } from "./rows.js";

/** In-memory BoardDataPort over the fictional fixtures; mutations bump the row version. */
export function createDemoBoardDataPort(): BoardDataPort {
  const tables = createDemoRows();
  let sourceRevision = 1;

  return {
    query: async (request) => {
      if (request.context.scope.tenantId !== DEMO_TENANT_ID) {
        throw new Error("Forbidden: tenant mismatch");
      }
      const rows = tables.get(request.tableId);
      if (!rows) throw new Error(`Unknown table ${request.tableId}`);
      const visible = applyDemoView(request.tableId, request.viewId, rows);
      return demoDelay({ rows: visible, sourceVersion: `demo-${sourceRevision}` }, 220);
    },
    mutate: async (request) => {
      const { input } = request;
      const rows = tables.get(input.tableId);
      const index = rows?.findIndex((row) => row.id === input.recordId) ?? -1;
      const current = rows?.[index];
      if (!rows || !current) throw new Error("Record not found");
      if (current.version !== input.baseVersion) {
        throw new Error(
          `Conflict: record is at version ${current.version}, edit started from ${input.baseVersion}`,
        );
      }
      const updated: RecordEnvelope = {
        ...current,
        values: { ...current.values, ...input.values },
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: request.scope.userId,
        updatedPositionId: request.scope.positionId,
      };
      rows[index] = updated;
      sourceRevision += 1;
      return demoDelay(
        { recordId: updated.id, version: updated.version, auditEventId: demoId() },
        200,
      );
    },
  };
}
