import type { JobHandler, JobPayloadBase } from "./context.js";

export interface ImportRecordsJobPayload extends JobPayloadBase {
  readonly importRunId: string;
  readonly sourceFileId: string;
  readonly tableId: string;
  readonly mappingDefinitionVersionId: string;
  readonly dryRun: boolean;
}

export interface ExportRecordsJobPayload extends JobPayloadBase {
  readonly exportRunId: string;
  readonly tableId: string;
  readonly viewId: string | null;
  readonly format: "csv" | "xlsx" | "json" | "argus-pack";
  readonly requestedFields: readonly string[];
}

/**
 * TODO(implementation): parse, validate, deduplicate, and atomically apply one bounded import batch.
 * Input: ImportRecordsJobPayload referencing quarantined source, table, and immutable mapping version.
 * Output: dry-run error/mapping report or committed batch progress with idempotent resume cursor.
 * Errors: rejects unsafe formulas/types and unauthorized fields; transient batches retry without duplication.
 * Depends on: CSV/XLSX parser, field plugins, DDL metadata, RLS/FLS repositories, files, and audit.
 * Security: imported ownership/audit columns are server-derived and no cell is executed as code/formula.
 */
export const importRecords: JobHandler<ImportRecordsJobPayload> = (_context) => {
  throw new Error("TODO(implementation): importRecords");
};

/**
 * TODO(implementation): stream an authorized export to quarantined object storage and finalize its manifest.
 * Input: ExportRecordsJobPayload with table/view, format, requested fields, and scoped initiator.
 * Output: export progress/completion with a short-lived download grant produced by the API.
 * Errors: rejects excessive/unauthorized exports and resumes bounded batches without leaking partial files.
 * Depends on: RLS/FLS record reads, export formatters, S3-compatible storage, redaction, and audit.
 * Security: exports obey incident, soft-delete, position, and field policy even for privileged API keys.
 */
export const exportRecords: JobHandler<ExportRecordsJobPayload> = (_context) => {
  throw new Error("TODO(implementation): exportRecords");
};
