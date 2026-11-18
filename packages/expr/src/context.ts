import type { CelLiteralValue, CelType, ExpressionUse, ParsedCelExpression } from "./ast.js";
import type { ExpressionCapability } from "./capabilities.js";

/** Narrow local identity ports until `@argus/schema` exports canonical ids. */
declare const localIdBrand: unique symbol;
export type LocalId<Name extends string> = string & {
  readonly [localIdBrand]: Name;
};
export type TenantId = LocalId<"TenantId">;
export type IncidentId = LocalId<"IncidentId">;
export type UserId = LocalId<"UserId">;
export type PositionId = LocalId<"PositionId">;

/** Host-independent timestamp and duration values; no ambient clock is consulted. */
export interface CelTimestampValue {
  readonly kind: "timestamp";
  readonly iso8601: string;
}

export interface CelDurationValue {
  readonly kind: "duration";
  readonly nanoseconds: bigint;
}

/** Serializable/sandboxed runtime values; host class instances and functions are excluded. */
export type CelValue =
  | CelLiteralValue
  | CelTimestampValue
  | CelDurationValue
  | readonly CelValue[]
  | { readonly [key: string]: CelValue };

export interface TypedCelValue<Value extends CelValue = CelValue> {
  readonly type: CelType;
  readonly value: Value;
}

/** Actor identity is server-derived and used for policy decisions, not supplied by CEL. */
export interface ExpressionActor {
  readonly userId: UserId | null;
  readonly positionId: PositionId | null;
  readonly kind: "user" | "api-key" | "system-job";
}

/** Mandatory tenant/incident boundary for evaluation and SQL compilation. */
export interface ExpressionSecurityContext {
  readonly tenantId: TenantId;
  readonly incidentId: IncidentId | null;
  readonly scope: "incident" | "global";
  readonly actor: ExpressionActor;
  readonly requestId: string;
  readonly correlationId: string;
}

/** Provenance lets the evaluator reject cross-tenant and cross-incident bindings. */
export interface CelBindingProvenance {
  readonly tenantId: TenantId;
  readonly incidentId: IncidentId | null;
  readonly recordId: string | null;
}

export type CelBindingSource =
  | "record"
  | "user"
  | "position"
  | "incident"
  | "workflow"
  | "request"
  | "constant";

/** Value-free variable declaration used by parsing, typing, and capability analysis. */
export interface CelBindingDeclaration {
  readonly name: string;
  readonly source: CelBindingSource;
  readonly type: CelType;
}

/** One immutable typed variable exposed under an allow-listed CEL name. */
export interface CelBinding {
  readonly name: string;
  readonly source: CelBindingSource;
  readonly typedValue: TypedCelValue;
  readonly provenance: CelBindingProvenance;
}

/** Allow-listed function signature; implementation code is never part of the context. */
export interface CelFunctionSignature {
  readonly name: string;
  readonly receiver: CelType | null;
  readonly parameters: readonly CelType[];
  readonly result: CelType;
  readonly deterministic: boolean;
  readonly allowedUses: readonly ExpressionUse[];
  readonly capabilities: readonly ExpressionCapability[];
}

/** Hard limits enforced before and during parsing/evaluation/SQL compilation. */
export interface SandboxLimits {
  readonly maxSourceBytes: number;
  readonly maxAstDepth: number;
  readonly maxAstNodes: number;
  readonly maxEvaluationSteps: number;
  readonly maxEvaluationMilliseconds: number;
  readonly maxCollectionItems: number;
  readonly maxStringBytes: number;
  readonly maxBytesLength: number;
  readonly maxSqlParameters: number;
}

/**
 * Complete evaluation context. `now` is fixed by the trusted caller so `now()`
 * is deterministic within one evaluation; no network, filesystem, environment,
 * ambient time, dynamic code, or host-object access is available.
 */
export interface TypedExpressionContext {
  readonly security: ExpressionSecurityContext;
  readonly use: ExpressionUse;
  readonly bindings: readonly CelBinding[];
  readonly functions: readonly CelFunctionSignature[];
  readonly limits: SandboxLimits;
  readonly now: CelTimestampValue;
}

/** Type-only view used without exposing runtime record values to the checker. */
export interface CelTypeEnvironment {
  readonly use: ExpressionUse;
  readonly bindings: readonly CelBindingDeclaration[];
  readonly functions: readonly CelFunctionSignature[];
  readonly expectedType: CelType | null;
}

/** Common input for pure evaluation and use-specific wrappers. */
export interface CelEvaluationRequest {
  readonly expression: ParsedCelExpression;
  readonly context: TypedExpressionContext;
}
