/** JSON values accepted for driver-serialized `json`/`jsonb` parameters. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Values must reach PostgreSQL only through driver parameters, never interpolation. */
export type SqlScalarValue = null | boolean | number | bigint | string | Uint8Array | Date;
export type SqlParameterValue = SqlScalarValue | readonly SqlScalarValue[] | JsonValue;

/** PostgreSQL types understood by the adapter; extensions remain explicit. */
export type SqlParameterType =
  | "uuid"
  | "text"
  | "boolean"
  | "integer"
  | "bigint"
  | "numeric"
  | "timestamp"
  | "timestamptz"
  | "date"
  | "jsonb"
  | "bytea"
  | "geometry"
  | "array";

declare const quotedIdentifierBrand: unique symbol;

/** A fully quoted SQL identifier produced only by `quoteSqlIdentifier`. */
export type QuotedSqlIdentifier = string & {
  readonly [quotedIdentifierBrand]: "QuotedSqlIdentifier";
};

/** One positional parameter using PostgreSQL's one-based placeholder index. */
export interface SqlParameter {
  readonly index: number;
  readonly type: SqlParameterType;
  readonly value: SqlParameterValue;
}

/**
 * SQL text may contain quoted identifiers and `$n` placeholders only. Values
 * are carried separately and the executor must reject a parameter count or
 * index mismatch. This type does not certify authorization or RLS.
 */
export interface ParameterizedSql {
  readonly text: string;
  readonly parameters: readonly SqlParameter[];
}

/** The two immutable physical names allocated to each user table. */
export interface PhysicalTableNames {
  readonly table: QuotedSqlIdentifier;
  readonly view: QuotedSqlIdentifier;
}

/** Non-executable details reported by SQL safety validation. */
export interface SqlSafetyIssue {
  readonly code:
    | "unquoted-identifier"
    | "inline-value"
    | "parameter-index-gap"
    | "parameter-count-mismatch"
    | "multiple-statements";
  readonly message: string;
  readonly offset: number | null;
}

export interface SqlSafetyReport {
  readonly safe: boolean;
  readonly issues: readonly SqlSafetyIssue[];
}

/**
 * TODO(implementation): quote one PostgreSQL identifier without interpreting it
 * as a qualified path, including embedded quotes and NUL/control-character rejection.
 * Input: A single untrusted logical or allocated identifier.
 * Output: A branded, safely quoted identifier suitable for static DDL text.
 * Errors: Throws on empty, invalid, or non-single identifiers; never returns raw input.
 * Depends on: PostgreSQL 18 identifier rules and adapter conformance tests.
 */
export function quoteSqlIdentifier(_identifier: string): QuotedSqlIdentifier {
  throw new Error("TODO(implementation): quoteSqlIdentifier");
}

/**
 * TODO(implementation): allocate a positional SQL parameter without rendering its value.
 * Input: A one-based index, explicit PostgreSQL type, and serializable parameter value.
 * Output: A parameter descriptor for a `ParameterizedSql` statement.
 * Errors: Throws on invalid indexes, non-finite numbers, unsupported values, or unsafe dates.
 * Depends on: PostgreSQL driver serialization; values must never be stringified into SQL.
 */
export function createSqlParameter(
  _index: number,
  _type: SqlParameterType,
  _value: SqlParameterValue,
): SqlParameter {
  throw new Error("TODO(implementation): createSqlParameter");
}

/**
 * TODO(implementation): derive and quote the stable `t_<short_id>` physical table name.
 * Input: The immutable catalog short id, never a tenant-supplied display name.
 * Output: A quoted physical table identifier stable across display-name changes.
 * Errors: Throws when the short id violates the reserved lowercase identifier grammar.
 * Depends on: Catalog short-id uniqueness enforced within the tenant schema.
 */
export function physicalTableName(_shortId: string): QuotedSqlIdentifier {
  throw new Error("TODO(implementation): physicalTableName");
}

/**
 * TODO(implementation): derive and quote the stable `v_<table>` read view name.
 * Input: The same immutable short id used for the physical table.
 * Output: The quoted `v_<short_id>` identifier used for rollups and reporting.
 * Errors: Throws on invalid short ids or collisions with reserved physical names.
 * Depends on: `physicalTableName` and catalog short-id allocation.
 */
export function physicalViewName(_shortId: string): QuotedSqlIdentifier {
  throw new Error("TODO(implementation): physicalViewName");
}

/**
 * TODO(implementation): validate statement shape before any executor accepts it.
 * Input: SQL with separately supplied parameters and no executable connection.
 * Output: A non-executable report describing identifier, value, and placeholder defects.
 * Errors: Throws only for malformed report inputs; unsafe SQL is returned as issues.
 * Depends on: SQL lexer safety tests; this check supplements rather than replaces RLS.
 */
export function inspectSqlSafety(_statement: ParameterizedSql): SqlSafetyReport {
  throw new Error("TODO(implementation): inspectSqlSafety");
}
