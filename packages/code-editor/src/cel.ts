import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import { LanguageSupport, StreamLanguage } from "@codemirror/language";

export type CelTokenClass =
  | "keyword"
  | "string"
  | "number"
  | "operator"
  | "identifier"
  | "property"
  | "function"
  | "punctuation"
  | "invalid";

export interface CelToken {
  readonly from: number;
  readonly to: number;
  readonly class: CelTokenClass;
  readonly text: string;
}

const KEYWORDS = new Set(["true", "false", "null", "in"]);
const OPERATORS = [
  "&&",
  "||",
  "==",
  "!=",
  "<=",
  ">=",
  "<",
  ">",
  "!",
  "?",
  ":",
  "+",
  "-",
  "*",
  "/",
  "%",
];
const PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ",", "."]);
const NUMBER = /^(?:0[xX][0-9a-fA-F]+[uU]?|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[uU]?)/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/;
const WHITESPACE = /\s/;

function stringLength(text: string, start: number): number {
  const quote = text.charAt(start);
  const triple = text.startsWith(quote.repeat(3), start);
  const delimiter = triple ? quote.repeat(3) : quote;
  let pos = start + delimiter.length;
  while (pos < text.length) {
    if (text.charAt(pos) === "\\") {
      pos += 2;
    } else if (text.startsWith(delimiter, pos)) {
      return pos + delimiter.length - start;
    } else if (!triple && text.charAt(pos) === "\n") {
      break;
    } else {
      pos++;
    }
  }
  return Math.min(pos, text.length) - start; // unterminated: colour to end of line/input
}

/** Scans one token at `pos` (which must not be whitespace). Shared by the tokenizer and the editor mode. */
export function scanCelToken(
  text: string,
  pos: number,
): { readonly length: number; readonly class: CelTokenClass } {
  const ch = text.charAt(pos);
  if (ch === '"' || ch === "'") return { length: stringLength(text, pos), class: "string" };
  // Raw / bytes string prefixes: r"..", b'..'
  if (/[rRbB]/.test(ch) && /["']/.test(text.charAt(pos + 1))) {
    return { length: 1 + stringLength(text, pos + 1), class: "string" };
  }
  const rest = text.slice(pos);
  const number = NUMBER.exec(rest);
  if (number) return { length: number[0].length, class: "number" };
  const identifier = IDENTIFIER.exec(rest);
  if (identifier) {
    const word = identifier[0];
    if (KEYWORDS.has(word)) return { length: word.length, class: "keyword" };
    let before = pos - 1;
    while (before >= 0 && WHITESPACE.test(text.charAt(before))) before--;
    let after = pos + word.length;
    while (after < text.length && WHITESPACE.test(text.charAt(after))) after++;
    if (text.charAt(after) === "(") return { length: word.length, class: "function" };
    return {
      length: word.length,
      class: text.charAt(before) === "." ? "property" : "identifier",
    };
  }
  for (const operator of OPERATORS) {
    if (text.startsWith(operator, pos)) return { length: operator.length, class: "operator" };
  }
  if (PUNCTUATION.has(ch)) return { length: 1, class: "punctuation" };
  return { length: 1, class: "invalid" };
}

/** Splits a CEL expression into classified tokens (whitespace is skipped). */
export function tokenizeCel(source: string): CelToken[] {
  const tokens: CelToken[] = [];
  let pos = 0;
  while (pos < source.length) {
    if (WHITESPACE.test(source.charAt(pos))) {
      pos++;
      continue;
    }
    const { length, class: tokenClass } = scanCelToken(source, pos);
    tokens.push({
      from: pos,
      to: pos + length,
      class: tokenClass,
      text: source.slice(pos, pos + length),
    });
    pos += length;
  }
  return tokens;
}

const STYLE_BY_CLASS: Record<CelTokenClass, string> = {
  keyword: "keyword",
  string: "string",
  number: "number",
  operator: "operator",
  identifier: "variableName",
  property: "propertyName",
  function: "function variableName",
  punctuation: "punctuation",
  invalid: "invalid",
};

export const celLanguage = StreamLanguage.define<null>({
  name: "cel",
  startState: () => null,
  token(stream) {
    if (stream.eatSpace()) return null;
    const { length, class: tokenClass } = scanCelToken(stream.string, stream.pos);
    stream.pos += length;
    return STYLE_BY_CLASS[tokenClass];
  },
  languageData: { closeBrackets: { brackets: ["(", "[", "{", '"', "'"] } },
});

const BUILTIN_FUNCTIONS: readonly Completion[] = [
  { label: "now()", type: "function", detail: "timestamp" },
  { label: "size()", type: "function", detail: "int" },
  { label: "has()", type: "function", detail: "bool" },
  { label: "int()", type: "function", detail: "int" },
  { label: "double()", type: "function", detail: "double" },
  { label: "string()", type: "function", detail: "string" },
  { label: "timestamp()", type: "function", detail: "timestamp" },
  { label: "duration()", type: "function", detail: "duration" },
];

/**
 * Autocomplete for CEL expressions. `identifiers` are fully qualified paths the host knows are
 * valid in this context, e.g. `record.status`, `user.position.name`.
 */
export function celCompletions(identifiers: readonly string[]): CompletionSource {
  const options: Completion[] = [
    ...identifiers.map((label): Completion => ({ label, type: "variable" })),
    ...BUILTIN_FUNCTIONS,
  ];
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_][\w.]*/);
    if (!word && !context.explicit) return null;
    return { from: word ? word.from : context.pos, options, validFor: /^[\w.]*$/ };
  };
}

/** CEL language plus identifier completion, ready to drop into an editor. */
export function cel(identifiers: readonly string[] = []): LanguageSupport {
  return new LanguageSupport(celLanguage, [
    celLanguage.data.of({ autocomplete: celCompletions(identifiers) }),
  ]);
}
