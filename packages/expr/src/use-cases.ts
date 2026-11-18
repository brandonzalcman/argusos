import type { CelType, ExpressionUse, ParsedCelExpression } from "./ast.js";
import type { CelBindingSource, TypedExpressionContext } from "./context.js";
import type { CelEvaluationResult } from "./evaluator.js";

/** Narrows a request so each wrapper only accepts its declared product surface. */
export type UseCaseEvaluationRequest<Use extends ExpressionUse> = {
  readonly expression: ParsedCelExpression & { readonly source: { readonly use: Use } };
  readonly context: TypedExpressionContext & { readonly use: Use };
};

/** Static policy consumed by builder validation and capability analysis. */
export interface ExpressionUsePolicy {
  readonly use: ExpressionUse;
  readonly result: "boolean" | "declared-field-type";
  readonly allowedBindingSources: readonly CelBindingSource[];
  readonly allowComprehensions: boolean;
  readonly allowNonDeterministicFunctions: boolean;
  readonly sqlCapabilities: readonly (
    | "sql-query"
    | "sql-generated-column"
    | "sql-view"
    | "sql-default"
  )[];
}

/**
 * TODO(implementation): return the immutable allow-list policy for a product expression use.
 * Input: Visibility, validation, default, formula, or workflow-condition surface.
 * Output: Expected result shape, permitted binding sources, functions, and SQL capabilities.
 * Errors: Throws on an unknown surface; does not inspect or execute expression source.
 * Depends on: Product authorization decisions and the function/capability registry.
 */
export function expressionUsePolicy(_use: ExpressionUse): ExpressionUsePolicy {
  throw new Error("TODO(implementation): expressionUsePolicy");
}

/**
 * TODO(implementation): evaluate a block/field visibility expression as strict boolean.
 * Input: Parsed visibility CEL and authorized record/user/position/incident bindings.
 * Output: Boolean typed result with usage, or a redacted type/security/sandbox issue.
 * Errors: Returns non-boolean, cross-incident, unsupported, and limit failures.
 * Depends on: `evaluateCel`, visibility policy, and fail-closed UI handling.
 */
export function evaluateVisibilityExpression(
  _request: UseCaseEvaluationRequest<"visibility">,
): CelEvaluationResult<boolean> {
  throw new Error("TODO(implementation): evaluateVisibilityExpression");
}

/**
 * TODO(implementation): evaluate record validation as strict boolean without mutating records.
 * Input: Parsed validation CEL, candidate record, and tenant/incident-bound actor context.
 * Output: Boolean validity with usage or a redacted failure; message text remains catalog metadata.
 * Errors: Returns type, isolation, unsupported, and sandbox failures; callers must fail closed.
 * Depends on: `evaluateCel`, validation policy, and API/database validation enforcement.
 */
export function evaluateValidationExpression(
  _request: UseCaseEvaluationRequest<"validation">,
): CelEvaluationResult<boolean> {
  throw new Error("TODO(implementation): evaluateValidationExpression");
}

/**
 * TODO(implementation): evaluate a field default against its declared field type.
 * Input: Parsed default CEL, expected field type, and authorized creation-time bindings.
 * Output: A typed default value or a redacted failure; no record write is performed.
 * Errors: Returns result-type, isolation, nondeterminism, unsupported, and sandbox failures.
 * Depends on: `evaluateCel`, field-type adapters, and default-use policy.
 */
export function evaluateDefaultExpression(
  _request: UseCaseEvaluationRequest<"default">,
  _expectedType: CelType,
): CelEvaluationResult {
  throw new Error("TODO(implementation): evaluateDefaultExpression");
}

/**
 * TODO(implementation): evaluate a formula in application mode without generating SQL.
 * Input: Parsed formula CEL, expected result type, and immutable authorized bindings.
 * Output: A typed formula value with usage or a redacted failure; no recursion into formulas.
 * Errors: Returns type/cycle/isolation/nondeterminism/unsupported/sandbox failures.
 * Depends on: `evaluateCel`, formula dependency graph, field types, and formula-use policy.
 */
export function evaluateFormulaExpression(
  _request: UseCaseEvaluationRequest<"formula">,
  _expectedType: CelType,
): CelEvaluationResult {
  throw new Error("TODO(implementation): evaluateFormulaExpression");
}

/**
 * TODO(implementation): evaluate a workflow trigger/condition as strict boolean.
 * Input: Parsed workflow CEL and authorized record/workflow/incident bindings.
 * Output: Boolean decision with usage or a redacted failure; no workflow step is executed.
 * Errors: Returns non-boolean, cross-incident, external-access, and sandbox failures.
 * Depends on: `evaluateCel`, workflow policy, durable run audit, and fail-closed scheduling.
 */
export function evaluateWorkflowCondition(
  _request: UseCaseEvaluationRequest<"workflow-condition">,
): CelEvaluationResult<boolean> {
  throw new Error("TODO(implementation): evaluateWorkflowCondition");
}
