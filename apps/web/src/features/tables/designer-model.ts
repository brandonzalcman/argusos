import type { FieldDefinition, FieldTypeId } from "@argus/schema";

/** Pure draft helpers for the table designer. Nothing here produces SQL; the DDL engine plans every change. */

const emptyAccess: FieldDefinition["access"] = {
  defaultMode: "editable",
  positions: [],
  accessRule: null,
};

/** Draft-local identity. The server/planner may re-allocate persisted ids; this only identifies the draft row. */
export function newDraftId(): string {
  return globalThis.crypto.randomUUID();
}

/** Lower snake_case definition key derived from a display name. Never used as a SQL identifier. */
export function slugifyKey(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefixed = /^[a-z]/.test(slug) ? slug : slug === "" ? "field" : `f_${slug}`;
  return prefixed.slice(0, 63);
}

/** Returns a key not present in `taken`, appending _2, _3, … when needed. */
export function uniqueKey(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, 63 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return `${base.slice(0, 50)}_${newDraftId().slice(0, 8).replaceAll("-", "")}`;
}

/** Default type-specific configuration. Relation/target ids are empty until the designer user chooses them. */
export function defaultConfigFor(type: FieldTypeId): FieldDefinition["config"] {
  switch (type) {
    case "text":
      return { maxLength: null, multiline: false };
    case "long-text":
      return { format: "plain" };
    case "number":
      return { precision: null, scale: null, minimum: null, maximum: null };
    case "currency":
      return { currencyCode: "USD", scale: 2 };
    case "percent":
      return { scale: 0, storage: "whole-number" };
    case "date":
      return { minimum: null, maximum: null };
    case "date-time":
      return { displayTimeZone: null, minimum: null, maximum: null };
    case "duration":
      return { storageUnit: "minutes", displayUnit: "automatic" };
    case "boolean":
      return { trueLabel: "Yes", falseLabel: "No" };
    case "single-select":
      return { options: [] };
    case "multi-select":
      return { options: [], maximumSelections: null };
    case "user":
    case "position":
      return { allowedPositionIds: [] };
    case "link-to-record":
      return { relationId: newDraftId(), targetTableId: "", allowMultiple: false };
    case "attachment":
      return { maximumFiles: null, maximumBytesPerFile: 10_485_760, allowedMimeTypes: [] };
    case "location":
      return { geometry: "point", srid: 4326 };
    case "phone":
      return { defaultRegion: null };
    case "email":
      return { allowedDomains: [] };
    case "url":
      return { allowedProtocols: ["https"] };
    case "status":
      return { options: [], initialOptionId: null, closedOptionIds: [] };
    case "formula":
      return { expression: "", resultType: null, execution: "sql-view" };
    case "rollup":
      return { relationId: "", targetFieldId: "", aggregation: "count" };
    case "lookup":
      return { relationId: "", targetFieldId: "" };
    case "auto-number":
      return { prefix: "", padding: 4, scope: "incident" };
    case "signature":
      return { meaning: "", requireReauthentication: true };
    case "json":
      return { jsonSchema: null };
  }
}

export function createDraftField(
  type: FieldTypeId,
  name: string,
  takenKeys: ReadonlySet<string>,
): FieldDefinition {
  return {
    id: newDraftId(),
    key: uniqueKey(slugifyKey(name), takenKeys),
    name,
    description: null,
    required: false,
    unique: false,
    indexed: false,
    defaultValue: null,
    sensitivity: "standard",
    access: { ...emptyAccess },
    type,
    config: defaultConfigFor(type),
  } as FieldDefinition;
}

/** Changes the type of a draft field, resetting type-specific config but keeping identity and metadata. */
export function withFieldType(field: FieldDefinition, type: FieldTypeId): FieldDefinition {
  return { ...field, type, config: defaultConfigFor(type) } as FieldDefinition;
}

export interface DraftIssue {
  readonly fieldId: string;
  readonly message: string;
}

export interface RelationTarget {
  readonly tableId: string;
  readonly fields: readonly FieldDefinition[];
}

const keyPattern = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * Client-side pre-checks so obvious mistakes never reach the planner. The DDL engine and API re-validate;
 * this is a convenience, not a security boundary.
 * TODO(implementation): validate formula expressions with @argus/expr once its parser port is implemented.
 */
export function validateDraft(
  fields: readonly FieldDefinition[],
  relations: ReadonlyMap<string, RelationTarget>,
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const keys = new Map<string, string>();
  const names = new Map<string, string>();
  const relationIds = new Map<string, FieldDefinition>();
  for (const f of fields) {
    if (f.type === "link-to-record") {
      relationIds.set(f.config.relationId, f);
    }
  }
  for (const f of fields) {
    const add = (message: string): void => {
      issues.push({ fieldId: f.id, message });
    };
    if (f.name.trim() === "") {
      add("Name is required.");
    }
    if (!keyPattern.test(f.key)) {
      add("Key must be lower snake_case, start with a letter, and be at most 63 characters.");
    }
    const keyOwner = keys.get(f.key);
    if (keyOwner && keyOwner !== f.id) {
      add(`Key “${f.key}” is already used by another field.`);
    }
    keys.set(f.key, f.id);
    const nameKey = f.name.trim().toLocaleLowerCase();
    if (nameKey !== "" && names.has(nameKey)) {
      add(`Another field is already named “${f.name.trim()}”.`);
    }
    names.set(nameKey, f.id);

    switch (f.type) {
      case "single-select":
      case "multi-select":
      case "status": {
        const active = f.config.options.filter((o) => !o.archived);
        if (active.length === 0) {
          add("Add at least one option.");
        }
        const labels = new Set<string>();
        for (const o of f.config.options) {
          const label = o.label.trim().toLocaleLowerCase();
          if (label === "") {
            add("Option labels cannot be empty.");
          } else if (labels.has(label)) {
            add(`Duplicate option “${o.label}”.`);
          }
          labels.add(label);
        }
        break;
      }
      case "link-to-record":
        if (f.config.targetTableId === "") {
          add("Choose the table to link to.");
        }
        break;
      case "rollup":
      case "lookup": {
        const relation = relationIds.get(f.config.relationId);
        if (relation?.type !== "link-to-record") {
          add("Choose a link field to read through.");
          break;
        }
        const target = relations.get(relation.config.targetTableId);
        if (!target?.fields.some((t) => t.id === f.config.targetFieldId)) {
          add("Choose a field on the linked table.");
        }
        break;
      }
      case "formula":
        if (f.config.expression.trim() === "") {
          add("Enter a formula expression.");
        }
        break;
      case "currency":
        if (!/^[A-Z]{3}$/.test(f.config.currencyCode)) {
          add("Currency must be a three-letter ISO code.");
        }
        break;
      case "signature":
        if (f.config.meaning.trim() === "") {
          add("Describe what a signature on this field means.");
        }
        break;
      case "url":
        if (f.config.allowedProtocols.length === 0) {
          add("Allow at least one protocol.");
        }
        break;
      default:
        break;
    }
    if (f.required && isEngineValued(f)) {
      // Computed fields are never required from the user's perspective.
      add("Computed fields cannot be required.");
    }
  }
  return issues;
}

function isEngineValued(f: FieldDefinition): boolean {
  return (
    f.type === "formula" || f.type === "rollup" || f.type === "lookup" || f.type === "auto-number"
  );
}

export type DraftChangeKind = "added" | "removed" | "modified";

export interface DraftChange {
  readonly fieldId: string;
  readonly kind: DraftChangeKind;
  readonly description: string;
}

/** Plain-words summary of unsaved edits (not the DDL plan; the engine's plan is the source of truth). */
export function describeDraftChanges(
  live: readonly FieldDefinition[],
  draft: readonly FieldDefinition[],
): DraftChange[] {
  const liveById = new Map(live.map((f) => [f.id, f]));
  const draftById = new Map(draft.map((f) => [f.id, f]));
  const changes: DraftChange[] = [];
  for (const f of draft) {
    const before = liveById.get(f.id);
    if (!before) {
      changes.push({
        fieldId: f.id,
        kind: "added",
        description: `Add field “${f.name}” (${f.type})`,
      });
      continue;
    }
    const parts: string[] = [];
    if (before.name !== f.name) {
      parts.push(`rename to “${f.name}”`);
    }
    if (before.type !== f.type) {
      parts.push(`change type ${before.type} → ${f.type}`);
    } else if (JSON.stringify(before.config) !== JSON.stringify(f.config)) {
      parts.push("change configuration");
    }
    if (before.required !== f.required) {
      parts.push(f.required ? "make required" : "make optional");
    }
    if (before.unique !== f.unique) {
      parts.push(f.unique ? "enforce uniqueness" : "drop uniqueness");
    }
    if (before.indexed !== f.indexed) {
      parts.push(f.indexed ? "add index" : "drop index");
    }
    if (
      before.description !== f.description ||
      before.sensitivity !== f.sensitivity ||
      JSON.stringify(before.defaultValue) !== JSON.stringify(f.defaultValue) ||
      JSON.stringify(before.access) !== JSON.stringify(f.access)
    ) {
      parts.push("update details/access");
    }
    if (parts.length > 0) {
      changes.push({
        fieldId: f.id,
        kind: "modified",
        description: `“${before.name}”: ${parts.join(", ")}`,
      });
    }
  }
  for (const f of live) {
    if (!draftById.has(f.id)) {
      changes.push({
        fieldId: f.id,
        kind: "removed",
        description: `Remove field “${f.name}” (hidden and retained, restorable during retention)`,
      });
    }
  }
  return changes;
}
