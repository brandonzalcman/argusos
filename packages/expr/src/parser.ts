import type { CelParseResult, CelSource, CelType, ParsedCelExpression } from "./ast.js";
import type { CelTypeEnvironment, SandboxLimits } from "./context.js";

/** Parser-specific limits prevent hostile source from exhausting memory or stack. */
export type CelParserLimits = Pick<SandboxLimits, "maxSourceBytes" | "maxAstDepth" | "maxAstNodes">;

/**
 * TODO(implementation): parse CEL source into the host-independent AST without evaluating it.
 * Input: Versioned expression source and strict source/AST size/depth limits.
 * Output: A parsed expression or diagnostics with precise spans; no host code is executed.
 * Errors: Returns parse/limit diagnostics; throws only for invalid parser configuration.
 * Depends on: A conformant CEL grammar, UTF-8 byte accounting, and recursion-safe parsing.
 */
export function parseCel(_source: CelSource, _limits: CelParserLimits): CelParseResult {
  throw new Error("TODO(implementation): parseCel");
}

export interface CelTypeIssue {
  readonly code:
    | "unknown-binding"
    | "unknown-function"
    | "invalid-member"
    | "invalid-index"
    | "argument-type"
    | "operator-type"
    | "condition-type"
    | "result-type"
    | "unsupported-expression";
  readonly message: string;
  readonly nodeId: number | null;
}

export interface CelTypeCheckSuccess {
  readonly ok: true;
  readonly type: CelType;
  readonly issues: readonly CelTypeIssue[];
}

export interface CelTypeCheckFailure {
  readonly ok: false;
  readonly issues: readonly CelTypeIssue[];
}

export type CelTypeCheckResult = CelTypeCheckSuccess | CelTypeCheckFailure;

/**
 * TODO(implementation): type-check CEL against immutable allow-listed bindings and functions.
 * Input: Parsed CEL and a value-free typed environment with an optional expected result type.
 * Output: Inferred result type or all detectable type/unsupported-use issues.
 * Errors: Returns type issues; throws on malformed AST or invalid environment declarations.
 * Depends on: CEL type rules and per-use function/binding policy; never reads runtime records.
 */
export function typeCheckCel(
  _expression: ParsedCelExpression,
  _environment: CelTypeEnvironment,
): CelTypeCheckResult {
  throw new Error("TODO(implementation): typeCheckCel");
}
