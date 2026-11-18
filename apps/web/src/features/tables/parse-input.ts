import type { FieldDefinition } from "@argus/schema";

export type ParsedInput =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string };

/**
 * Parses raw text (editor input, pasted cell, bulk value) into the canonical value for the field type.
 * Client-side parsing is a convenience only; the API re-validates with the field's Zod validator.
 * TODO(implementation): delegate to the plugin's `importExport.parseImport` once plugins implement it.
 */
export function parseEditorInput(field: FieldDefinition, raw: string): ParsedInput {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return field.required
      ? { ok: false, message: `${field.name} is required.` }
      : { ok: true, value: null };
  }
  switch (field.type) {
    case "text": {
      const max = field.config.maxLength;
      return max !== null && raw.length > max
        ? { ok: false, message: `At most ${max} characters.` }
        : { ok: true, value: raw };
    }
    case "number":
    case "currency":
    case "percent":
    case "duration": {
      const n = Number(trimmed.replace(/[,$%\s]/g, ""));
      if (!Number.isFinite(n)) {
        return { ok: false, message: "Enter a number." };
      }
      if (field.type === "number") {
        const { minimum, maximum } = field.config;
        if (minimum !== null && n < minimum) {
          return { ok: false, message: `Minimum is ${minimum}.` };
        }
        if (maximum !== null && n > maximum) {
          return { ok: false, message: `Maximum is ${maximum}.` };
        }
      }
      return {
        ok: true,
        value: field.type === "percent" && field.config.storage === "fraction" ? n / 100 : n,
      };
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? { ok: true, value: trimmed }
        : { ok: false, message: "Use the format YYYY-MM-DD." };
    case "date-time": {
      const t = new Date(trimmed);
      return Number.isNaN(t.getTime())
        ? { ok: false, message: "Enter a valid date and time." }
        : { ok: true, value: t.toISOString() };
    }
    case "boolean": {
      const lower = trimmed.toLocaleLowerCase();
      if (["true", "yes", "1", field.config.trueLabel.toLocaleLowerCase()].includes(lower)) {
        return { ok: true, value: true };
      }
      if (["false", "no", "0", field.config.falseLabel.toLocaleLowerCase()].includes(lower)) {
        return { ok: true, value: false };
      }
      return { ok: false, message: "Enter yes or no." };
    }
    case "single-select":
    case "status": {
      const match = field.config.options.find(
        (o) =>
          !o.archived &&
          (o.id === trimmed || o.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase()),
      );
      return match ? { ok: true, value: match.id } : { ok: false, message: "Not a known option." };
    }
    case "multi-select": {
      const picked: string[] = [];
      for (const part of trimmed
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        const match = field.config.options.find(
          (o) =>
            !o.archived &&
            (o.id === part || o.label.toLocaleLowerCase() === part.toLocaleLowerCase()),
        );
        if (!match) {
          return { ok: false, message: `“${part}” is not a known option.` };
        }
        picked.push(match.id);
      }
      const max = field.config.maximumSelections;
      return max !== null && picked.length > max
        ? { ok: false, message: `At most ${max} selections.` }
        : { ok: true, value: picked };
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
        ? { ok: true, value: trimmed }
        : { ok: false, message: "Enter a valid email address." };
    case "url":
      try {
        const url = new URL(trimmed);
        const proto = url.protocol.replace(":", "");
        return (field.config.allowedProtocols as readonly string[]).includes(proto)
          ? { ok: true, value: trimmed }
          : {
              ok: false,
              message: `Allowed protocols: ${field.config.allowedProtocols.join(", ")}.`,
            };
      } catch {
        return { ok: false, message: "Enter a valid URL." };
      }
    case "long-text":
    case "phone":
      return { ok: true, value: trimmed };
    case "user":
    case "position":
    case "link-to-record":
    case "attachment":
      // Ids and uploads cannot be typed or pasted; they go through the lookup / upload editors.
      return { ok: false, message: "Choose this value in the cell editor." };
    default:
      return { ok: false, message: "This field type cannot be edited here." };
  }
}
