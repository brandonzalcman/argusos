/** Product surfaces that share the same CEL language but not the same privileges. */
export type ExpressionUse =
  | "visibility"
  | "validation"
  | "default"
  | "formula"
  | "workflow-condition";

/** Zero-based source offsets plus human-readable positions for diagnostics. */
export interface CelSourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface CelSourceSpan {
  readonly start: CelSourcePosition;
  readonly end: CelSourcePosition;
}

/** Versioned source identity from `@argus/schema`; text is never SQL. */
export interface CelSource {
  readonly definitionId: string;
  readonly revision: number;
  readonly text: string;
  readonly use: ExpressionUse;
}

/** CEL's type contract, including unknown only for parse/type-check recovery. */
export type CelType =
  | { readonly kind: "null" }
  | { readonly kind: "bool" }
  | { readonly kind: "int" }
  | { readonly kind: "uint" }
  | { readonly kind: "double" }
  | { readonly kind: "string" }
  | { readonly kind: "bytes" }
  | { readonly kind: "timestamp" }
  | { readonly kind: "duration" }
  | { readonly kind: "list"; readonly element: CelType }
  | { readonly kind: "map"; readonly key: "string" | "int" | "uint"; readonly value: CelType }
  | {
      readonly kind: "record";
      readonly typeName: string;
      readonly fields: Readonly<Record<string, CelType>>;
    }
  | { readonly kind: "optional"; readonly value: CelType }
  | { readonly kind: "unknown" };

export type CelLiteralValue = null | boolean | number | bigint | string | Uint8Array;

interface CelNodeBase {
  readonly nodeId: number;
  readonly span: CelSourceSpan;
}

export interface CelLiteralNode extends CelNodeBase {
  readonly kind: "literal";
  readonly literalType: "null" | "bool" | "int" | "uint" | "double" | "string" | "bytes";
  readonly value: CelLiteralValue;
}

export interface CelIdentifierNode extends CelNodeBase {
  readonly kind: "identifier";
  readonly name: string;
}

export interface CelMemberNode extends CelNodeBase {
  readonly kind: "member";
  readonly target: CelNode;
  readonly field: string;
  readonly optional: boolean;
}

export interface CelIndexNode extends CelNodeBase {
  readonly kind: "index";
  readonly target: CelNode;
  readonly index: CelNode;
  readonly optional: boolean;
}

export interface CelCallNode extends CelNodeBase {
  readonly kind: "call";
  readonly functionName: string;
  readonly receiver: CelNode | null;
  readonly arguments: readonly CelNode[];
}

export type CelUnaryOperator = "!" | "-";
export type CelBinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "&&"
  | "||"
  | "in";

export interface CelUnaryNode extends CelNodeBase {
  readonly kind: "unary";
  readonly operator: CelUnaryOperator;
  readonly operand: CelNode;
}

export interface CelBinaryNode extends CelNodeBase {
  readonly kind: "binary";
  readonly operator: CelBinaryOperator;
  readonly left: CelNode;
  readonly right: CelNode;
}

export interface CelConditionalNode extends CelNodeBase {
  readonly kind: "conditional";
  readonly condition: CelNode;
  readonly whenTrue: CelNode;
  readonly whenFalse: CelNode;
}

export interface CelListNode extends CelNodeBase {
  readonly kind: "list";
  readonly elements: readonly CelNode[];
}

export interface CelMapEntry {
  readonly key: CelNode;
  readonly value: CelNode;
}

export interface CelMapNode extends CelNodeBase {
  readonly kind: "map";
  readonly entries: readonly CelMapEntry[];
}

/**
 * Reserved for CEL macro expansion. It is not a general-purpose loop: sandbox
 * policy may reject every comprehension or bound its finite input and steps.
 */
export interface CelComprehensionNode extends CelNodeBase {
  readonly kind: "comprehension";
  readonly iteratorVariable: string;
  readonly iteratorRange: CelNode;
  readonly accumulatorVariable: string;
  readonly accumulatorInitialValue: CelNode;
  readonly loopCondition: CelNode;
  readonly loopStep: CelNode;
  readonly result: CelNode;
}

/** Parser output AST; host objects, functions, and SQL fragments cannot be nodes. */
export type CelNode =
  | CelLiteralNode
  | CelIdentifierNode
  | CelMemberNode
  | CelIndexNode
  | CelCallNode
  | CelUnaryNode
  | CelBinaryNode
  | CelConditionalNode
  | CelListNode
  | CelMapNode
  | CelComprehensionNode;

export interface ParsedCelExpression {
  readonly source: CelSource;
  readonly root: CelNode;
  readonly nodeCount: number;
  readonly depth: number;
}

export interface CelParseDiagnostic {
  readonly severity: "error" | "warning";
  readonly code: "invalid-token" | "unexpected-token" | "invalid-literal" | "limit-exceeded";
  readonly message: string;
  readonly span: CelSourceSpan | null;
}

export interface CelParseSuccess {
  readonly ok: true;
  readonly expression: ParsedCelExpression;
  readonly diagnostics: readonly CelParseDiagnostic[];
}

export interface CelParseFailure {
  readonly ok: false;
  readonly diagnostics: readonly CelParseDiagnostic[];
}

export type CelParseResult = CelParseSuccess | CelParseFailure;
