import type { ParsedCelExpression } from "./ast.js";
import type { CelTypeEnvironment, ExpressionSecurityContext, SandboxLimits } from "./context.js";
import type { UnsupportedExpressionIssue } from "./errors.js";

/** Execution/compilation targets independently negotiated for each expression. */
export type ExpressionCapability =
  | "evaluation"
  | "sql-query"
  | "sql-generated-column"
  | "sql-view"
  | "sql-default";

export interface ExpressionCapabilityResult {
  readonly capability: ExpressionCapability;
  readonly supported: boolean;
  readonly issues: readonly UnsupportedExpressionIssue[];
}

/** Non-executable analysis context; runtime record values are intentionally absent. */
export interface CapabilityAnalysisContext {
  readonly security: ExpressionSecurityContext;
  readonly environment: CelTypeEnvironment;
  readonly limits: SandboxLimits;
}

/** Explains what an expression can do before a board or formula is published. */
export interface ExpressionCapabilityReport {
  readonly results: readonly ExpressionCapabilityResult[];
  readonly referencedBindings: readonly string[];
  readonly requiredFunctions: readonly string[];
  readonly deterministic: boolean;
  readonly estimatedAstNodes: number;
  readonly estimatedEvaluationSteps: number | null;
}

/**
 * TODO(implementation): analyze support for each requested evaluator/SQL target.
 * Input: Parsed CEL, type-only bindings, security scope, limits, and target capabilities.
 * Output: Per-target support with clear unsupported-expression issues and resource estimates.
 * Errors: Throws on malformed AST/context; ordinary unsupported features are returned as issues.
 * Depends on: AST/type checker, allow-listed function registry, and SQL capability rules.
 */
export function analyzeExpressionCapabilities(
  _expression: ParsedCelExpression,
  _context: CapabilityAnalysisContext,
  _targets: readonly ExpressionCapability[],
): ExpressionCapabilityReport {
  throw new Error("TODO(implementation): analyzeExpressionCapabilities");
}
