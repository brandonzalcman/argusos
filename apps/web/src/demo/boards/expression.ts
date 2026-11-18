import {
  type ExpressionDiagnostic,
  type ExpressionValidationPort,
  type ExpressionValidationResult,
  MAX_EXPRESSION_LENGTH,
} from "../../features/boards/expression.js";
import { demoDelay } from "../scenario.js";

const CLOSERS: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };
const BINARY_OPERATORS = ["&&", "||", "==", "!=", ">=", "<=", ">", "<", "+", "-", "*", "/", "%"];

/**
 * Lightweight demo check: non-empty, bounded, balanced brackets/quotes, no dangling binary
 * operator and no lone `=`. It is not a CEL parser and says nothing about types or bindings.
 */
export function checkDemoExpression(text: string): readonly ExpressionDiagnostic[] {
  const source = text.trim();
  if (source === "") return [{ message: "Enter an expression." }];
  if (text.length > MAX_EXPRESSION_LENGTH) return [{ message: "Expression is too long." }];

  const diagnostics: ExpressionDiagnostic[] = [];
  const stack: { readonly char: string; readonly offset: number }[] = [];
  let quote: string | null = null;
  let quoteStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";
    if (quote !== null) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      quoteStart = i;
    } else if (char in CLOSERS) {
      stack.push({ char, offset: i });
    } else if (char === ")" || char === "]" || char === "}") {
      const open = stack.pop();
      if (!open || CLOSERS[open.char] !== char) {
        return [{ message: `Unexpected "${char}".`, offset: i }];
      }
    } else if (char === "=") {
      const prev = text[i - 1] ?? "";
      const next = text[i + 1] ?? "";
      // Valid: "==", "!=", "<=", ">=". A lone "=" is an assignment, which CEL does not have.
      if (next === "=") {
        i += 1;
      } else if (!"!<>".includes(prev) || prev === "") {
        return [{ message: 'Use "==" to compare values.', offset: i }];
      }
    }
  }
  if (quote !== null) {
    diagnostics.push({ message: "Unterminated string.", offset: quoteStart });
  }
  for (const open of stack) {
    diagnostics.push({ message: `Missing closing "${CLOSERS[open.char]}".`, offset: open.offset });
  }
  const last = BINARY_OPERATORS.find((op) => source.endsWith(op));
  if (last && diagnostics.length === 0) {
    diagnostics.push({
      message: `Expression ends with "${last}"; add a value.`,
      offset: text.length,
    });
  }
  return diagnostics;
}

/** Demo adapter for the visibility-expression editor. */
export function createDemoExpressionValidation(): ExpressionValidationPort {
  return {
    validate: (request) => {
      const diagnostics = checkDemoExpression(request.text);
      const result: ExpressionValidationResult =
        diagnostics.length === 0 ? { status: "valid" } : { status: "invalid", diagnostics };
      return demoDelay(result, 120);
    },
  };
}
