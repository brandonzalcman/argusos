import type { CelLiteralValue, CelType, ExpressionUse, ParsedCelExpression } from "./ast.js";
import type {
  CelDurationValue,
  CelFunctionSignature,
  CelTimestampValue,
  ExpressionSecurityContext,
  SandboxLimits,
} from "./context.js";
import type { UnsupportedExpressionIssue } from "./errors.js";

/** Scalar/array parameter values accepted by the PostgreSQL adapter. */
export type CompiledSqlParameterValue =
  | CelLiteralValue
  | CelTimestampValue
  | CelDurationValue
  | readonly CelLiteralValue[];

/** One out-of-band `$n` parameter; its value is never present in `sql`. */
export interface CompiledSqlParameter {
  readonly index: number;
  readonly type: CelType;
  readonly value: CompiledSqlParameterValue;
}

/** Catalog-backed mapping from a CEL path to one unquoted PostgreSQL identifier. */
export interface SqlColumnBinding {
  readonly expressionPath: string;
  readonly identifier: string;
  readonly type: CelType;
  readonly nullable: boolean;
}

/** Physical table and mandatory RLS bindings supplied by the DDL/catalog boundary. */
export interface SqlTableBinding {
  readonly schemaIdentifier: string;
  readonly identifier: string;
  readonly alias: string;
  readonly columns: readonly SqlColumnBinding[];
  readonly tenantColumnIdentifier: string | null;
  readonly incidentColumnIdentifier: string | null;
}

/** SQL target has distinct determinism and capability rules. */
export type SqlCompilationMode = "query" | "generated-column" | "view" | "default";

/**
 * Compiler context contains no connection and cannot run SQL. Schema/table/column
 * ids come from trusted catalog metadata and are quoted by the compiler; CEL source,
 * record values, tenant ids, incident ids, and the fixed `now` value can only become parameters.
 * User tables normally use schema-per-tenant isolation, so a tenant column is optional.
 */
export interface SqlCompilationContext {
  readonly security: ExpressionSecurityContext;
  readonly use: ExpressionUse;
  readonly mode: SqlCompilationMode;
  readonly table: SqlTableBinding;
  readonly functions: readonly CelFunctionSignature[];
  readonly limits: SandboxLimits;
  readonly now: CelTimestampValue;
  readonly firstParameterIndex: number;
}

/** Compiled expression still requires an authorized query and database RLS. */
export interface CompiledCelSql {
  readonly sql: string;
  readonly parameters: readonly CompiledSqlParameter[];
  readonly mode: SqlCompilationMode;
  readonly referencedColumns: readonly string[];
  readonly deterministic: boolean;
  readonly requiredScope: ExpressionSecurityContext;
  readonly rowSecurity: "postgresql-rls-required";
}

export interface CompiledSqlSafetyIssue {
  readonly code:
    | "inline-value"
    | "unquoted-identifier"
    | "parameter-index-gap"
    | "parameter-count-mismatch"
    | "parameter-limit-exceeded"
    | "incident-scope-unavailable";
  readonly message: string;
}

export type SqlCompilationIssue = UnsupportedExpressionIssue | CompiledSqlSafetyIssue;

export interface SqlCompilationSuccess {
  readonly ok: true;
  readonly statement: CompiledCelSql;
}

export interface SqlCompilationFailure {
  readonly ok: false;
  readonly issues: readonly SqlCompilationIssue[];
}

export type SqlCompilationResult = SqlCompilationSuccess | SqlCompilationFailure;

/**
 * TODO(implementation): compile a supported CEL subset to parameterized PostgreSQL SQL.
 * Input: Typed AST, catalog-backed columns, allow-listed functions, scope, and target mode.
 * Output: SQL with quoted identifiers/`$n` placeholders and separate typed values, or issues.
 * Errors: Returns unsupported/nondeterministic/unsafe/scope failures; never executes SQL.
 * Depends on: CEL type checker, PostgreSQL semantics, identifier quoting, and RLS-protected queries.
 */
export function compileCelToSql(
  _expression: ParsedCelExpression,
  _context: SqlCompilationContext,
): SqlCompilationResult {
  throw new Error("TODO(implementation): compileCelToSql");
}

/**
 * TODO(implementation): compile formula CEL for a generated column or read-view expression.
 * Input: Formula-source AST and formula-use SQL context limited to immutable deterministic builtins.
 * Output: Parameterized formula SQL or explicit unsupported-expression issues.
 * Errors: Rejects `now()`, record/user/request ambiguity, cross-incident bindings, and unsafe SQL.
 * Depends on: `compileCelToSql`, formula dependency analysis, and PostgreSQL generated-column rules.
 */
export function compileFormulaToSql(
  _expression: ParsedCelExpression & { readonly source: { readonly use: "formula" } },
  _context: SqlCompilationContext & {
    readonly use: "formula";
    readonly mode: "generated-column" | "view";
  },
): SqlCompilationResult {
  throw new Error("TODO(implementation): compileFormulaToSql");
}

/**
 * TODO(implementation): inspect compiler output without connecting to PostgreSQL.
 * Input: Compiled SQL, separate parameters, and required tenant/incident scope.
 * Output: All detectable interpolation, identifier, placeholder, and isolation issues.
 * Errors: Throws only for malformed descriptors; unsafe statements are returned as issues.
 * Depends on: SQL lexer conformance tests; inspection supplements rather than replaces RLS.
 */
export function inspectCompiledSql(_statement: CompiledCelSql): readonly CompiledSqlSafetyIssue[] {
  throw new Error("TODO(implementation): inspectCompiledSql");
}
