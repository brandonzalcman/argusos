import {
  SANDBOX_CONSOLE_MAX_ARGS,
  SANDBOX_CONSOLE_MAX_LENGTH,
} from "../protocol/sandbox-messages.js";

/** Stringify one console argument safely: circular, huge, or throwing values never escape. */
export function formatConsoleArg(value: unknown): string {
  let out: string;
  if (typeof value === "string") {
    out = value;
  } else if (value instanceof Error) {
    out = `${value.name}: ${value.message}`;
  } else if (value === undefined) {
    out = "undefined";
  } else if (typeof value === "function") {
    out = `[function ${value.name || "anonymous"}]`;
  } else if (typeof value === "symbol" || typeof value === "bigint") {
    out = value.toString();
  } else {
    try {
      const seen = new WeakSet<object>();
      out =
        JSON.stringify(value, (_key, item: unknown) => {
          if (typeof item === "bigint") return item.toString();
          if (typeof item === "object" && item !== null) {
            if (seen.has(item)) return "[circular]";
            seen.add(item);
          }
          return item;
        }) ?? String(value);
    } catch {
      out = "[unserializable]";
    }
  }
  return out.length > SANDBOX_CONSOLE_MAX_LENGTH
    ? `${out.slice(0, SANDBOX_CONSOLE_MAX_LENGTH - 1)}…`
    : out;
}

export function formatConsoleArgs(args: readonly unknown[]): string[] {
  return args.slice(0, SANDBOX_CONSOLE_MAX_ARGS).map(formatConsoleArg);
}
