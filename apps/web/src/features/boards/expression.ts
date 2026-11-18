import {
  type CelParserLimits,
  type CelSource,
  type CelTypeEnvironment,
  parseCel,
  typeCheckCel,
} from "@argus/expr";

/**
 * Expression-editor seam for builder conditions (CEL), typed with the real @argus/expr contracts.
 * The request is exactly an @argus/expr `CelSource`; `createCelValidationPort` adapts the port to
 * `parseCel` + `typeCheckCel`. Those are still TODO(implementation) stubs in @argus/expr and throw,
 * which the editor reports as "not validated" — it never claims validity without a real check.
 */

export const MAX_EXPRESSION_LENGTH = 20_000;

/** Versioned CEL source identity from @argus/expr (definition id, revision, text, use). */
export type ExpressionValidationRequest = CelSource;

export interface ExpressionDiagnostic {
  readonly message: string;
  readonly offset?: number;
}

export type ExpressionValidationResult =
  | { readonly status: "valid" }
  | { readonly status: "invalid"; readonly diagnostics: readonly ExpressionDiagnostic[] };

export interface ExpressionValidationPort {
  readonly validate: (request: ExpressionValidationRequest) => Promise<ExpressionValidationResult>;
}

/** Throws TODO(implementation); the editor shows "validation unavailable". */
export function createExpressionValidationStub(): ExpressionValidationPort {
  return {
    validate: () => {
      throw new Error(
        "TODO(implementation): ExpressionValidationPort.validate (no adapter configured)",
      );
    },
  };
}

export interface CelValidationOptions {
  readonly limits: CelParserLimits;
  /** Value-free typed bindings/functions for the use; supplied by the host from field catalogs. */
  readonly environment: (request: CelSource) => CelTypeEnvironment;
}

/**
 * Adapter over @argus/expr: parse, then type-check against the supplied environment.
 * Errors: parser/checker failures that throw (today: TODO(implementation)) propagate to the caller.
 * Depends on: @argus/expr parseCel/typeCheckCel being implemented; TODO(decision) typed record bindings.
 */
export function createCelValidationPort(options: CelValidationOptions): ExpressionValidationPort {
  return {
    validate: async (request) => {
      const parsed = parseCel(request, options.limits);
      const errors = parsed.diagnostics
        .filter((d) => d.severity === "error")
        .map((d) => ({
          message: d.message,
          ...(d.span ? { offset: d.span.start.offset } : {}),
        }));
      if (!parsed.ok || errors.length > 0) {
        return { status: "invalid", diagnostics: errors };
      }
      const checked = typeCheckCel(parsed.expression, options.environment(request));
      if (!checked.ok) {
        return {
          status: "invalid",
          diagnostics: checked.issues.map((issue) => ({ message: issue.message })),
        };
      }
      return { status: "valid" };
    },
  };
}

/** Bindings the visibility use-case may reference (see @argus/expr ExpressionUsePolicy). */
export const visibilityBindingSources = ["record", "user", "position", "incident"] as const;

// ---------------------------------------------------------------------------------------------
// Point-and-click condition model, compiled to / parsed from CEL source text.
// ---------------------------------------------------------------------------------------------

export const conditionOperators = ["==", "!=", ">", ">=", "<", "<="] as const;
export type ConditionOperator = (typeof conditionOperators)[number];
export type ConditionValueType = "string" | "number" | "boolean" | "null";
export type ConditionJoiner = "&&" | "||";

export interface ConditionRow {
  /** Dotted binding path, e.g. `record.priority`. */
  readonly path: string;
  readonly operator: ConditionOperator;
  readonly valueType: ConditionValueType;
  /** Raw text for string/number; "true"/"false" for boolean; ignored for null. */
  readonly value: string;
}

export interface ConditionGroup {
  readonly joiner: ConditionJoiner;
  readonly rows: readonly ConditionRow[];
}

const PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const NUMBER_PATTERN = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;

/** Escapes a value into a CEL string literal. Values are never concatenated unescaped. */
export function celStringLiteral(value: string): string {
  let out = '"';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\\") out += "\\\\";
    else if (char === '"') out += '\\"';
    else if (char === "\n") out += "\\n";
    else if (char === "\r") out += "\\r";
    else if (char === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += char;
  }
  return `${out}"`;
}

export type CompileResult =
  | { readonly ok: true; readonly source: string }
  | { readonly ok: false; readonly errors: readonly string[] };

export function compileCondition(group: ConditionGroup): CompileResult {
  const errors: string[] = [];
  const parts: string[] = [];
  group.rows.forEach((row, index) => {
    const label = `Condition ${index + 1}`;
    if (!PATH_PATTERN.test(row.path)) {
      errors.push(`${label}: field must be a dotted name such as record.priority.`);
      return;
    }
    let literal: string;
    switch (row.valueType) {
      case "string":
        literal = celStringLiteral(row.value);
        break;
      case "number":
        if (!NUMBER_PATTERN.test(row.value)) {
          errors.push(`${label}: value must be a number.`);
          return;
        }
        literal = row.value;
        break;
      case "boolean":
        if (row.value !== "true" && row.value !== "false") {
          errors.push(`${label}: value must be true or false.`);
          return;
        }
        literal = row.value;
        break;
      case "null":
        literal = "null";
        break;
    }
    parts.push(`${row.path} ${row.operator} ${literal}`);
  });
  if (parts.length === 0 && errors.length === 0) {
    errors.push("Add at least one condition.");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const source = parts.join(` ${group.joiner} `);
  if (source.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, errors: ["Expression is too long."] };
  }
  return { ok: true, source };
}

type Token =
  | { readonly t: "path"; readonly v: string }
  | { readonly t: "op"; readonly v: string }
  | { readonly t: "str"; readonly v: string }
  | { readonly t: "num"; readonly v: string }
  | { readonly t: "join"; readonly v: ConditionJoiner };

function tokenize(source: string): readonly Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i] ?? "";
    if (/\s/.test(char)) {
      i += 1;
    } else if (char === '"') {
      let value = "";
      i += 1;
      let closed = false;
      while (i < source.length) {
        const c = source[i] ?? "";
        if (c === '"') {
          closed = true;
          i += 1;
          break;
        }
        if (c === "\\") {
          const n = source[i + 1];
          if (n === "\\" || n === '"') value += n;
          else if (n === "n") value += "\n";
          else if (n === "r") value += "\r";
          else if (n === "t") value += "\t";
          else if (n === "u" && /^[0-9a-f]{4}$/i.test(source.slice(i + 2, i + 6))) {
            value += String.fromCodePoint(Number.parseInt(source.slice(i + 2, i + 6), 16));
            i += 4;
          } else return null;
          i += 2;
        } else {
          value += c;
          i += 1;
        }
      }
      if (!closed) return null;
      tokens.push({ t: "str", v: value });
    } else if (source.startsWith("&&", i) || source.startsWith("||", i)) {
      tokens.push({ t: "join", v: source.slice(i, i + 2) as ConditionJoiner });
      i += 2;
    } else if (/[=!<>]/.test(char)) {
      const two = source.slice(i, i + 2);
      const op = ["==", "!=", ">=", "<="].includes(two) ? two : char;
      if (!(conditionOperators as readonly string[]).includes(op)) return null;
      tokens.push({ t: "op", v: op });
      i += op.length;
    } else if (/[-0-9]/.test(char)) {
      const match = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?/.exec(source.slice(i));
      if (!match) return null;
      tokens.push({ t: "num", v: match[0] });
      i += match[0].length;
    } else if (/[A-Za-z_]/.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(source.slice(i));
      if (!match) return null;
      tokens.push({ t: "path", v: match[0] });
      i += match[0].length;
    } else {
      return null;
    }
  }
  return tokens;
}

/**
 * Parses source previously written by `compileCondition` back into rows.
 * Returns null for anything outside that subset; the raw editor remains the power-user path.
 */
export function parseCondition(source: string): ConditionGroup | null {
  const tokens = tokenize(source);
  if (!tokens || tokens.length === 0) return null;
  const rows: ConditionRow[] = [];
  let joiner: ConditionJoiner | null = null;
  let index = 0;
  while (index < tokens.length) {
    const path = tokens[index];
    const op = tokens[index + 1];
    const value = tokens[index + 2];
    if (path?.t !== "path" || op?.t !== "op" || !value) return null;
    const operator = op.v as ConditionOperator;
    if (value.t === "str") {
      rows.push({ path: path.v, operator, valueType: "string", value: value.v });
    } else if (value.t === "num") {
      rows.push({ path: path.v, operator, valueType: "number", value: value.v });
    } else if (value.t === "path" && (value.v === "true" || value.v === "false")) {
      rows.push({ path: path.v, operator, valueType: "boolean", value: value.v });
    } else if (value.t === "path" && value.v === "null") {
      rows.push({ path: path.v, operator, valueType: "null", value: "" });
    } else {
      return null;
    }
    index += 3;
    const next = tokens[index];
    if (next === undefined) break;
    if (next.t !== "join" || (joiner !== null && joiner !== next.v)) return null;
    joiner = next.v;
    index += 1;
    if (index >= tokens.length) return null;
  }
  return { joiner: joiner ?? "&&", rows };
}
