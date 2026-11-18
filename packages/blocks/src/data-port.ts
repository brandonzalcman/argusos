import type { RecordEnvelope, UpdateRecordInput } from "@argus/schema";
import type { BlockRenderContext, BlockSecurityScope } from "./types.js";

export interface BoardDataRequest {
  readonly context: BlockRenderContext;
  readonly sourceId: string;
  readonly tableId: string;
  readonly viewId?: string;
}

export interface BoardDataResult {
  /** Authorized system/field envelopes; hidden values are removed before reaching the browser. */
  readonly rows: readonly RecordEnvelope[];
  readonly sourceVersion: string;
}

export interface BoardMutationRequest {
  readonly scope: BlockSecurityScope;
  readonly input: UpdateRecordInput;
  readonly idempotencyKey: string;
}

export interface BoardMutationResult {
  readonly recordId: string;
  readonly version: number;
  readonly auditEventId: string;
}

/** Authorized board data seam. Every implementation must apply RLS, incident, and field policies. */
export interface BoardDataPort {
  readonly query: (request: BoardDataRequest) => Promise<BoardDataResult>;
  readonly mutate: (request: BoardMutationRequest) => Promise<BoardMutationResult>;
}

function dataPortNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): BoardDataPort.${method}`);
}

/**
 * TODO(implementation): connect board reads/writes to the scoped API and Electric live-query layer.
 * Input: operation context, source/query identity, shared update input, and idempotency key.
 * Output: a port whose methods always throw until the authorized API/sync adapter is supplied.
 * Errors: every method throws TODO(implementation); no data or mutation is fabricated.
 * Depends on: apps/api authorization/audit, @argus/schema, and Electric sync. RLS remains mandatory.
 */
export function createBoardDataPortStub(): BoardDataPort {
  return {
    query: () => dataPortNotImplemented("query"),
    mutate: () => dataPortNotImplemented("mutate"),
  };
}
