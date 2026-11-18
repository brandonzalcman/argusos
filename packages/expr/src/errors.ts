import type { CelSourceSpan } from "./ast.js";
import type { ExpressionCapability } from "./capabilities.js";

/** Why an otherwise valid CEL expression cannot run on a requested target. */
export type UnsupportedExpressionReason =
  | "unsupported-node"
  | "unsupported-function"
  | "unsupported-operator"
  | "unsupported-type"
  | "non-deterministic"
  | "comprehension-disabled"
  | "host-access-forbidden"
  | "sandbox-limit"
  | "sql-parameter-limit"
  | "incident-scope-unavailable";

/** Structured unsupported-expression diagnostic safe to return to builders. */
export interface UnsupportedExpressionIssue {
  readonly code: "UNSUPPORTED_EXPRESSION";
  readonly reason: UnsupportedExpressionReason;
  readonly message: string;
  readonly capability: ExpressionCapability;
  readonly span: CelSourceSpan | null;
  readonly nodeId: number | null;
}

export type CelExpressionErrorCode =
  | "PARSE_FAILED"
  | "TYPE_CHECK_FAILED"
  | "UNSUPPORTED_EXPRESSION"
  | "UNKNOWN_BINDING"
  | "TENANT_MISMATCH"
  | "INCIDENT_ISOLATION_VIOLATION"
  | "SANDBOX_LIMIT_EXCEEDED"
  | "EVALUATION_FAILED"
  | "SQL_COMPILATION_FAILED";

/** Public base error; details must exclude record values, credentials, and raw SQL data. */
export class CelExpressionError extends Error {
  public readonly code: CelExpressionErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(
    code: CelExpressionErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "CelExpressionError";
    this.code = code;
    this.details = details;
  }
}

/** Error used when callers require throwing rather than result-based diagnostics. */
export class UnsupportedExpressionError extends CelExpressionError {
  public readonly issue: UnsupportedExpressionIssue;

  public constructor(issue: UnsupportedExpressionIssue) {
    super("UNSUPPORTED_EXPRESSION", issue.message, {
      reason: issue.reason,
      capability: issue.capability,
      nodeId: issue.nodeId,
    });
    this.name = "UnsupportedExpressionError";
    this.issue = issue;
  }
}
