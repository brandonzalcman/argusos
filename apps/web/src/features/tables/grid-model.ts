import type {
  FieldDefinition,
  FilterCondition,
  FilterGroup,
  RecordEnvelope,
  ViewGrouping,
  ViewSort,
} from "@argus/schema";
import { lookupLabel } from "./lookup-cache.js";

/**
 * Pure, side-effect free view logic over already-authorized live rows.
 * Server-side queries remain authoritative for permissions and paging; these functions only shape
 * rows the caller may already read, and never build SQL.
 */
export interface GridViewState {
  readonly filters: FilterGroup | null;
  readonly sorts: readonly ViewSort[];
  readonly grouping: ViewGrouping | null;
  readonly hiddenFieldIds: readonly string[];
  readonly fieldOrder: readonly string[];
}

export const emptyViewState: GridViewState = {
  filters: null,
  sorts: [],
  grouping: null,
  hiddenFieldIds: [],
  fieldOrder: [],
};

export type DisplayRow =
  | {
      readonly kind: "group";
      readonly key: string;
      readonly label: string;
      readonly count: number;
      readonly collapsed: boolean;
    }
  | { readonly kind: "row"; readonly record: RecordEnvelope };

/** Values are keyed by field `key` in the record envelope. TODO(verify): confirm with the generated table API. */
export function cellValue(record: RecordEnvelope, field: FieldDefinition): unknown {
  return record.values[field.key];
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asTime(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function comparable(field: FieldDefinition, value: unknown): number | string | null {
  if (isEmpty(value)) {
    return null;
  }
  switch (field.type) {
    case "number":
    case "currency":
    case "percent":
    case "duration":
      return asNumber(value);
    case "date":
    case "date-time":
      return asTime(value);
    case "boolean":
      return value === true ? 1 : 0;
    case "single-select":
    case "status": {
      const option = field.config.options.find((o) => o.id === value);
      return option ? option.order : String(value);
    }
    default:
      return String(value).toLocaleLowerCase();
  }
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : isEmpty(value) ? [] : [String(value)];
}

function operand(field: FieldDefinition, raw: unknown): number | string | null {
  switch (field.type) {
    case "number":
    case "currency":
    case "percent":
    case "duration":
      return asNumber(raw);
    case "date":
    case "date-time":
      return asTime(raw);
    default:
      return isEmpty(raw) ? null : String(raw).toLocaleLowerCase();
  }
}

/** Evaluates one condition. Unknown operators never filter rows out, so a view can't silently hide data. */
export function matchesCondition(
  record: RecordEnvelope,
  field: FieldDefinition,
  condition: FilterCondition,
): boolean {
  const value = cellValue(record, field);
  switch (condition.operator) {
    case "is-empty":
      return isEmpty(value);
    case "is-not-empty":
      return !isEmpty(value);
    case "in":
    case "not-in": {
      const wanted = asStringList(condition.value).map((v) => v.toLocaleLowerCase());
      const actual = asStringList(value).map((v) => v.toLocaleLowerCase());
      const hit = actual.some((v) => wanted.includes(v));
      return condition.operator === "in" ? hit : !hit;
    }
    case "contains":
    case "not-contains":
    case "starts-with":
    case "ends-with": {
      const needle = operand(field, condition.value);
      const parts = Array.isArray(value)
        ? value.map((v) => String(v).toLocaleLowerCase())
        : [String(value ?? "").toLocaleLowerCase()];
      const text = typeof needle === "string" ? needle : String(needle ?? "");
      const hit = parts.some((p) =>
        condition.operator === "starts-with"
          ? p.startsWith(text)
          : condition.operator === "ends-with"
            ? p.endsWith(text)
            : p.includes(text),
      );
      return condition.operator === "not-contains" ? !hit : hit;
    }
    case "equals":
    case "not-equals": {
      const left = comparable(field, value);
      const right = operand(field, condition.value);
      const same =
        Array.isArray(value) && field.type === "multi-select"
          ? asStringList(value).includes(String(condition.value))
          : field.type === "single-select" || field.type === "status"
            ? value === condition.value
            : left === right;
      return condition.operator === "equals" ? same : !same;
    }
    case "greater-than":
    case "greater-than-or-equal":
    case "less-than":
    case "less-than-or-equal":
    case "after":
    case "before": {
      const left = comparable(field, value);
      const right = operand(field, condition.value);
      if (left === null || right === null || typeof left !== typeof right) {
        return false;
      }
      switch (condition.operator) {
        case "greater-than":
        case "after":
          return left > right;
        case "greater-than-or-equal":
          return left >= right;
        case "less-than":
        case "before":
          return left < right;
        default:
          return left <= right;
      }
    }
    default:
      return true;
  }
}

export function matchesGroup(
  record: RecordEnvelope,
  group: FilterGroup,
  fieldsById: ReadonlyMap<string, FieldDefinition>,
): boolean {
  const results: boolean[] = [];
  for (const condition of group.conditions) {
    const field = fieldsById.get(condition.fieldId);
    // A condition on a field the caller can't see is ignored rather than leaking its existence.
    if (field) {
      results.push(matchesCondition(record, field, condition));
    }
  }
  for (const child of group.groups) {
    results.push(matchesGroup(record, child, fieldsById));
  }
  if (results.length === 0) {
    return true;
  }
  return group.conjunction === "and" ? results.every(Boolean) : results.some(Boolean);
}

export function sortRecords(
  records: readonly RecordEnvelope[],
  sorts: readonly ViewSort[],
  fieldsById: ReadonlyMap<string, FieldDefinition>,
): RecordEnvelope[] {
  const active = sorts.flatMap((s) => {
    const field = fieldsById.get(s.fieldId);
    return field ? [{ sort: s, field }] : [];
  });
  const result = [...records];
  // Stable tiebreak by creation time then id keeps the order deterministic while rows stream in.
  result.sort((a, b) => {
    for (const { sort, field } of active) {
      const left = comparable(field, cellValue(a, field));
      const right = comparable(field, cellValue(b, field));
      if (left === right) {
        continue;
      }
      if (left === null || right === null) {
        const nullFirst = sort.nulls === "first";
        return left === null ? (nullFirst ? -1 : 1) : nullFirst ? 1 : -1;
      }
      const cmp =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
      if (cmp !== 0) {
        return sort.direction === "ascending" ? cmp : -cmp;
      }
    }
    return a.createdAt === b.createdAt
      ? a.id.localeCompare(b.id)
      : a.createdAt.localeCompare(b.createdAt);
  });
  return result;
}

export function filterRecords(
  records: readonly RecordEnvelope[],
  filters: FilterGroup | null,
  fieldsById: ReadonlyMap<string, FieldDefinition>,
): RecordEnvelope[] {
  if (!filters) {
    return [...records];
  }
  return records.filter((r) => matchesGroup(r, filters, fieldsById));
}

/** Human label for a grouping bucket. */
export function groupLabel(field: FieldDefinition, value: unknown): string {
  if (isEmpty(value)) {
    return "(empty)";
  }
  if (field.type === "single-select" || field.type === "status") {
    return field.config.options.find((o) => o.id === value)?.label ?? String(value);
  }
  if (field.type === "boolean") {
    return value === true ? field.config.trueLabel : field.config.falseLabel;
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function buildDisplayRows(
  records: readonly RecordEnvelope[],
  grouping: ViewGrouping | null,
  fieldsById: ReadonlyMap<string, FieldDefinition>,
  collapsedKeys: ReadonlySet<string>,
): DisplayRow[] {
  const field = grouping ? fieldsById.get(grouping.fieldId) : undefined;
  if (!grouping || !field) {
    return records.map((record) => ({ kind: "row", record }));
  }
  const buckets = new Map<string, { label: string; rows: RecordEnvelope[] }>();
  for (const record of records) {
    const value = cellValue(record, field);
    const key = isEmpty(value) ? "__empty__" : JSON.stringify(value);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.rows.push(record);
    } else {
      buckets.set(key, { label: groupLabel(field, value), rows: [record] });
    }
  }
  const ordered = [...buckets.entries()].sort(([, a], [, b]) =>
    grouping.direction === "ascending"
      ? a.label.localeCompare(b.label)
      : b.label.localeCompare(a.label),
  );
  const out: DisplayRow[] = [];
  for (const [key, bucket] of ordered) {
    const collapsed = collapsedKeys.has(key);
    out.push({ kind: "group", key, label: bucket.label, count: bucket.rows.length, collapsed });
    if (!collapsed) {
      for (const record of bucket.rows) {
        out.push({ kind: "row", record });
      }
    }
  }
  return out;
}

/** Fields shown, honouring saved field order and hidden columns; unknown ids are ignored. */
export function visibleFields(
  fields: readonly FieldDefinition[],
  state: Pick<GridViewState, "hiddenFieldIds" | "fieldOrder">,
): FieldDefinition[] {
  const hidden = new Set(state.hiddenFieldIds);
  const rank = new Map(state.fieldOrder.map((id, index) => [id, index]));
  return fields
    .filter((f) => f.access.defaultMode !== "hidden" && !hidden.has(f.id))
    .map((f, index) => ({ f, index }))
    .sort((a, b) => (rank.get(a.f.id) ?? 1_000 + a.index) - (rank.get(b.f.id) ?? 1_000 + b.index))
    .map(({ f }) => f);
}

const unitMs = { milliseconds: 1, seconds: 1_000, minutes: 60_000 } as const;

/** Display text for a cell. Computed/secret rendering is the server's concern; this never invents values. */
export function formatCellValue(field: FieldDefinition, value: unknown): string {
  if (isEmpty(value)) {
    return "";
  }
  switch (field.type) {
    case "number": {
      const n = asNumber(value);
      return n === null
        ? String(value)
        : n.toLocaleString(undefined, { maximumFractionDigits: field.config.scale ?? 6 });
    }
    case "currency": {
      const n = asNumber(value);
      return n === null
        ? String(value)
        : n.toLocaleString(undefined, {
            style: "currency",
            currency: field.config.currencyCode,
            minimumFractionDigits: field.config.scale,
            maximumFractionDigits: field.config.scale,
          });
    }
    case "percent": {
      const n = asNumber(value);
      if (n === null) {
        return String(value);
      }
      const pct = field.config.storage === "fraction" ? n * 100 : n;
      return `${pct.toLocaleString(undefined, { maximumFractionDigits: field.config.scale })}%`;
    }
    case "duration": {
      const n = asNumber(value);
      if (n === null) {
        return String(value);
      }
      const totalMinutes = Math.round((n * unitMs[field.config.storageUnit]) / 60_000);
      const d = Math.floor(totalMinutes / 1_440);
      const h = Math.floor((totalMinutes % 1_440) / 60);
      const m = totalMinutes % 60;
      return [d ? `${d}d` : "", h ? `${h}h` : "", m || totalMinutes === 0 ? `${m}m` : ""]
        .filter(Boolean)
        .join(" ");
    }
    case "date":
      return String(value);
    case "date-time": {
      const t = asTime(value);
      if (t === null) {
        return String(value);
      }
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
        ...(field.config.displayTimeZone ? { timeZone: field.config.displayTimeZone } : {}),
      }).format(t);
    }
    case "boolean":
      return value === true ? field.config.trueLabel : field.config.falseLabel;
    case "single-select":
    case "status":
      return field.config.options.find((o) => o.id === value)?.label ?? String(value);
    case "multi-select": {
      const labels = new Map(field.config.options.map((o) => [o.id, o.label]));
      return asStringList(value)
        .map((id) => labels.get(id) ?? id)
        .join(", ");
    }
    case "user":
    case "position":
    case "link-to-record":
      return asStringList(value).map(lookupLabel).join(", ");
    case "attachment":
      return Array.isArray(value)
        ? value
            .map((v) => (v && typeof v === "object" && "name" in v ? String(v.name) : ""))
            .filter(Boolean)
            .join(", ")
        : "";
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/** Relative age such as "3 min ago"; always paired with the absolute timestamp by callers. */
export function relativeAge(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    return "";
  }
  const seconds = Math.max(0, Math.round((now - t) / 1_000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}
