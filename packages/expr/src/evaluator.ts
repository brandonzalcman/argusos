import type { CelSourceSpan } from "./ast.js";
import type { CelEvaluationRequest, CelValue, TypedCelValue } from "./context.js";

/** Resource accounting is returned for observability and budget conformance tests. */
export interface CelEvaluationUsage {
  readonly evaluationSteps: number;
  readonly elapsedMilliseconds: number;
  readonly peakCollectionItems: number;
  readonly peakStringBytes: number;
  readonly peakBytesLength: number;
}

/** Expected evaluation failures are data; raw record values are never included. */
export interface CelEvaluationIssue {
  readonly code:
    | "unknown-binding"
    | "type-error"
    | "division-by-zero"
    | "numeric-overflow"
    | "missing-key"
    | "unsupported-expression"
    | "step-limit-exceeded"
    | "deadline-exceeded"
    | "collection-limit-exceeded"
    | "string-limit-exceeded"
    | "bytes-limit-exceeded"
    | "tenant-mismatch"
    | "incident-isolation-violation";
  readonly message: string;
  readonly nodeId: number | null;
  readonly span: CelSourceSpan | null;
}

export interface CelEvaluationSuccess<Value extends CelValue = CelValue> {
  readonly ok: true;
  readonly result: TypedCelValue<Value>;
  readonly usage: CelEvaluationUsage;
}

export interface CelEvaluationFailure {
  readonly ok: false;
  readonly issue: CelEvaluationIssue;
  readonly usage: CelEvaluationUsage;
}

export type CelEvaluationResult<Value extends CelValue = CelValue> =
  | CelEvaluationSuccess<Value>
  | CelEvaluationFailure;

/**
 * TODO(implementation): evaluate parsed CEL with allow-listed builtins and hard sandbox budgets.
 * Input: Parsed AST plus typed immutable bindings, fixed time, security scope, and limits.
 * Output: A typed value with usage accounting, or a redacted evaluation/limit/security issue.
 * Errors: Returns expected evaluation failures; throws only for malformed evaluator setup.
 * Depends on: CEL semantics, monotonic deadline checks, and binding provenance isolation.
 * Security: No loops outside bounded comprehensions, host callbacks, dynamic code, I/O, or secrets.
 */
export function evaluateCel(_request: CelEvaluationRequest): CelEvaluationResult {
  throw new Error("TODO(implementation): evaluateCel");
}
