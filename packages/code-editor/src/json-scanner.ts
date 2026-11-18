/** A located JSON value. `from`/`to` are character offsets into the scanned text. */
export interface JsonNode {
  readonly kind: "object" | "array" | "string" | "literal";
  readonly from: number;
  to: number;
  readonly entries: JsonEntry[];
  readonly items: JsonNode[];
}

export interface JsonEntry {
  readonly key: string;
  readonly keyFrom: number;
  readonly keyTo: number;
  readonly value: JsonNode | null;
}

export interface JsonScan {
  readonly root: JsonNode | null;
  /** Offset of the first structural problem, or null when the text is well formed. */
  readonly errorOffset: number | null;
}

const WHITESPACE = /\s/;
const LITERAL = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/;

/**
 * Tolerant JSON scanner: records value positions even when the document is incomplete or
 * slightly malformed (trailing commas, missing values), so diagnostics still resolve while
 * the user is typing. It never throws and always terminates.
 */
export function scanJson(text: string): JsonScan {
  let pos = 0;
  let errorOffset: number | null = null;

  const fail = (offset: number): void => {
    if (errorOffset === null) errorOffset = offset;
  };
  const skipWhitespace = (): void => {
    while (pos < text.length && WHITESPACE.test(text.charAt(pos))) pos++;
  };

  const scanString = (): JsonNode => {
    const from = pos;
    pos++; // opening quote
    let closed = false;
    while (pos < text.length) {
      const ch = text.charAt(pos);
      if (ch === "\\") {
        pos += 2;
      } else if (ch === '"') {
        pos++;
        closed = true;
        break;
      } else if (ch === "\n") {
        break;
      } else {
        pos++;
      }
    }
    pos = Math.min(pos, text.length);
    if (!closed) fail(pos);
    return { kind: "string", from, to: pos, entries: [], items: [] };
  };

  const decodeKey = (node: JsonNode): string => {
    const raw = text.slice(node.from, node.to);
    try {
      const decoded: unknown = JSON.parse(raw);
      if (typeof decoded === "string") return decoded;
    } catch {
      // fall through to the raw text without quotes
    }
    return raw.replace(/^"/, "").replace(/"$/, "");
  };

  const scanLiteral = (): JsonNode | null => {
    const from = pos;
    while (pos < text.length) {
      const ch = text.charAt(pos);
      if (ch === "," || ch === "}" || ch === "]" || ch === ":" || WHITESPACE.test(ch)) break;
      pos++;
    }
    if (pos === from) {
      fail(pos);
      return null;
    }
    if (!LITERAL.test(text.slice(from, pos))) fail(from);
    return { kind: "literal", from, to: pos, entries: [], items: [] };
  };

  // Function declarations so the mutually recursive scanners can reference each other.
  function scanValue(): JsonNode | null {
    skipWhitespace();
    if (pos >= text.length) {
      fail(pos);
      return null;
    }
    const ch = text.charAt(pos);
    if (ch === "{") return scanObject();
    if (ch === "[") return scanArray();
    if (ch === '"') return scanString();
    return scanLiteral();
  }

  function scanObject(): JsonNode {
    const node: JsonNode = { kind: "object", from: pos, to: pos, entries: [], items: [] };
    pos++; // {
    let afterComma = false;
    let expectEntry = true;
    while (pos < text.length) {
      skipWhitespace();
      if (pos >= text.length) break;
      const ch = text.charAt(pos);
      if (ch === "}") {
        if (afterComma) fail(pos);
        pos++;
        node.to = pos;
        return node;
      }
      if (ch === ",") {
        fail(pos);
        pos++;
        afterComma = true;
        expectEntry = true;
        continue;
      }
      if (ch !== '"') {
        // Unexpected token where a key should be: skip it so we always progress.
        fail(pos);
        pos++;
        continue;
      }
      if (!expectEntry) fail(pos);
      const keyNode = scanString();
      skipWhitespace();
      let value: JsonNode | null = null;
      if (text.charAt(pos) === ":") {
        pos++;
        value = scanValue();
      } else {
        fail(pos);
      }
      node.entries.push({
        key: decodeKey(keyNode),
        keyFrom: keyNode.from,
        keyTo: keyNode.to,
        value,
      });
      skipWhitespace();
      if (text.charAt(pos) === ",") {
        pos++;
        afterComma = true;
        expectEntry = true;
      } else {
        afterComma = false;
        expectEntry = false;
      }
    }
    fail(pos);
    node.to = pos;
    return node;
  }

  function scanArray(): JsonNode {
    const node: JsonNode = { kind: "array", from: pos, to: pos, entries: [], items: [] };
    pos++; // [
    let afterComma = false;
    let needsComma = false;
    while (pos < text.length) {
      skipWhitespace();
      if (pos >= text.length) break;
      const ch = text.charAt(pos);
      if (ch === "]") {
        if (afterComma) fail(pos);
        pos++;
        node.to = pos;
        return node;
      }
      if (ch === ",") {
        if (!needsComma) fail(pos);
        pos++;
        afterComma = true;
        needsComma = false;
        continue;
      }
      if (ch === "}") {
        fail(pos);
        pos++;
        continue;
      }
      if (needsComma) fail(pos);
      const before = pos;
      const item = scanValue();
      if (item) node.items.push(item);
      if (pos === before) pos++; // guarantee progress
      afterComma = false;
      needsComma = true;
    }
    fail(pos);
    node.to = pos;
    return node;
  }

  const root = scanValue();
  skipWhitespace();
  if (root && pos < text.length) fail(pos); // trailing content
  return { root, errorOffset };
}
