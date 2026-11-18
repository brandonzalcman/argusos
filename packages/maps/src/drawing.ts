import type { Feature, Geometry } from "geojson";
import type { MapAuditContext, MapSecurityScope, Unsubscribe } from "./contracts.js";

export type DrawingMode = "point" | "line" | "polygon" | "select";

export interface DrawingSession {
  readonly sessionId: string;
  readonly mode: DrawingMode;
  readonly scope: MapSecurityScope;
  readonly audit: MapAuditContext;
}

export interface DrawingCommit {
  readonly session: DrawingSession;
  readonly tableId: string;
  readonly recordId?: string;
  readonly baseVersion: number;
  readonly feature: Feature<Geometry>;
  readonly idempotencyKey: string;
}

export interface DrawingResult {
  readonly recordId: string;
  readonly version: number;
  readonly auditEventId: string;
}

export interface DrawingPort {
  readonly start: (session: DrawingSession) => void;
  readonly cancel: (sessionId: string, scope: MapSecurityScope) => void;
  readonly onChange: (listener: (feature: Feature<Geometry> | null) => void) => Unsubscribe;
  readonly commit: (commit: DrawingCommit) => Promise<DrawingResult>;
}

function drawingNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): DrawingPort.${method}`);
}

/**
 * TODO(implementation): provide keyboard-usable drawing/editing and audited PostGIS record commits.
 * Input: scoped drawing sessions, GeoJSON features, record identity, and optimistic base version.
 * Output: a throwing port; future commits return server record/version/audit identifiers.
 * Errors: every method throws TODO(implementation); future conflicts must not overwrite geometry.
 * Depends on: MapAdapter, geometry validation, API/RLS, offline conflict handling, and audit writes.
 * Geometry and properties require field-level authorization; no annotation is persisted by this stub.
 */
export function createDrawingPortStub(): DrawingPort {
  return {
    start: () => drawingNotImplemented("start"),
    cancel: () => drawingNotImplemented("cancel"),
    onChange: () => drawingNotImplemented("onChange"),
    commit: () => drawingNotImplemented("commit"),
  };
}
