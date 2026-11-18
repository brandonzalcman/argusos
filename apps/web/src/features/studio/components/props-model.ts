import {
  type ComponentProp,
  type ComponentPropType,
  componentPropTypeSchema,
  definitionKeySchema,
} from "@argus/schema";

/** Maximum number of declared props (mirrors customComponentDefinitionSchema). */
export const MAX_COMPONENT_PROPS = 50;

function propTypeLabel(type: ComponentPropType): string {
  switch (type) {
    case "string":
      return "Text (single line)";
    case "text":
      return "Text (multi-line)";
    case "number":
      return "Number";
    case "boolean":
      return "Yes / no";
    case "enum":
      return "Choice list";
    case "color":
      return "Colour";
    case "cel":
      return "CEL expression";
    case "table":
      return "Table reference";
    case "field":
      return "Field reference";
    case "board":
      return "Board reference";
    case "page":
      return "Page reference";
    case "url":
      return "URL";
  }
}

export const propTypeOptions: readonly {
  readonly value: ComponentPropType;
  readonly label: string;
}[] = componentPropTypeSchema.options.map((value) => ({ value, label: propTypeLabel(value) }));

export interface PropIssue {
  /** Index of the offending prop, or null for list-level problems. */
  readonly index: number | null;
  readonly field: "key" | "label" | "options" | "defaultValue" | "list";
  readonly message: string;
}

/** Suggests an unused lower_snake_case key such as `prop_3`. */
export function nextPropKey(props: readonly ComponentProp[]): string {
  const used = new Set(props.map((p) => p.key));
  let n = props.length + 1;
  while (used.has(`prop_${n}`)) n += 1;
  return `prop_${n}`;
}

export function newProp(props: readonly ComponentProp[]): ComponentProp {
  const key = nextPropKey(props);
  return {
    key,
    label: `Property ${key.slice("prop_".length)}`,
    description: null,
    type: "string",
    required: false,
    defaultValue: null,
    options: [],
  };
}

/** Appends a new prop; no-op once the schema limit is reached. */
export function addProp(props: readonly ComponentProp[]): ComponentProp[] {
  if (props.length >= MAX_COMPONENT_PROPS) return [...props];
  return [...props, newProp(props)];
}

export function removeProp(props: readonly ComponentProp[], index: number): ComponentProp[] {
  return props.filter((_, i) => i !== index);
}

/** Moves a prop by `delta` positions (negative = earlier), clamped to the list. */
export function moveProp(
  props: readonly ComponentProp[],
  index: number,
  delta: number,
): ComponentProp[] {
  const target = Math.max(0, Math.min(props.length - 1, index + delta));
  if (index < 0 || index >= props.length || target === index) return [...props];
  const next = [...props];
  const [item] = next.splice(index, 1);
  if (item) next.splice(target, 0, item);
  return next;
}

/** Whether a default value suits the prop type; null is always allowed (no default). */
export function isValidDefault(prop: ComponentProp): boolean {
  const value = prop.defaultValue;
  if (value === null) return true;
  switch (prop.type) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      return typeof value === "string" && prop.options.some((o) => o.value === value);
    default:
      return typeof value === "string";
  }
}

/**
 * Replaces fields of one prop. Changing the type clears what no longer applies (options for
 * non-enum, an incompatible default) so the result always stays schema-shaped.
 */
export function updateProp(
  props: readonly ComponentProp[],
  index: number,
  patch: Partial<ComponentProp>,
): ComponentProp[] {
  return props.map((prop, i) => {
    if (i !== index) return prop;
    let next: ComponentProp = { ...prop, ...patch };
    if (patch.type !== undefined && patch.type !== prop.type) {
      next = {
        ...next,
        options: patch.type === "enum" ? next.options : [],
        defaultValue: null,
      };
    }
    if (next.type === "enum" && next.defaultValue !== null && !isValidDefault(next)) {
      next = { ...next, defaultValue: null };
    }
    return next;
  });
}

export function addOption(props: readonly ComponentProp[], index: number): ComponentProp[] {
  const prop = props[index];
  if (prop?.type !== "enum") return [...props];
  const n = prop.options.length + 1;
  return updateProp(props, index, {
    options: [...prop.options, { value: `option_${n}`, label: `Option ${n}` }],
  });
}

export function removeOption(
  props: readonly ComponentProp[],
  index: number,
  optionIndex: number,
): ComponentProp[] {
  const prop = props[index];
  if (!prop) return [...props];
  return updateProp(props, index, { options: prop.options.filter((_, i) => i !== optionIndex) });
}

export function updateOption(
  props: readonly ComponentProp[],
  index: number,
  optionIndex: number,
  patch: Partial<{ value: string; label: string }>,
): ComponentProp[] {
  const prop = props[index];
  if (!prop) return [...props];
  return updateProp(props, index, {
    options: prop.options.map((o, i) => (i === optionIndex ? { ...o, ...patch } : o)),
  });
}

/** Validates the declared props the way the schema does, with messages for inline display. */
export function validateProps(props: readonly ComponentProp[]): PropIssue[] {
  const issues: PropIssue[] = [];
  if (props.length > MAX_COMPONENT_PROPS) {
    issues.push({
      index: null,
      field: "list",
      message: `A component can declare at most ${MAX_COMPONENT_PROPS} props.`,
    });
  }
  const seen = new Set<string>();
  props.forEach((prop, index) => {
    if (!definitionKeySchema.safeParse(prop.key).success) {
      issues.push({
        index,
        field: "key",
        message: "Use lower_snake_case: start with a letter, then letters, digits or underscores.",
      });
    } else if (seen.has(prop.key)) {
      issues.push({ index, field: "key", message: `Key "${prop.key}" is already used.` });
    }
    seen.add(prop.key);
    if (prop.label.trim().length === 0) {
      issues.push({ index, field: "label", message: "A label is required." });
    }
    if (prop.type === "enum") {
      if (prop.options.length === 0) {
        issues.push({ index, field: "options", message: "Add at least one choice." });
      }
      const values = new Set<string>();
      for (const option of prop.options) {
        if (option.value.trim().length === 0) {
          issues.push({ index, field: "options", message: "Every choice needs a value." });
        } else if (values.has(option.value)) {
          issues.push({
            index,
            field: "options",
            message: `Choice value "${option.value}" is repeated.`,
          });
        }
        values.add(option.value);
      }
    } else if (prop.options.length > 0) {
      issues.push({
        index,
        field: "options",
        message: "Only choice-list props can have options.",
      });
    }
    if (!isValidDefault(prop)) {
      issues.push({
        index,
        field: "defaultValue",
        message: "The default value doesn't match the prop type.",
      });
    }
  });
  return issues;
}

/**
 * Values passed to the preview: the user's preview edits where set, otherwise the declared
 * default. Props with neither are omitted. Never persisted, never part of the definition.
 */
export function resolvePreviewValues(
  props: readonly ComponentProp[],
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const prop of props) {
    const override = overrides[prop.key];
    if (override !== undefined && override !== null && override !== "") {
      values[prop.key] = override;
    } else if (prop.defaultValue !== null) {
      values[prop.key] = prop.defaultValue;
    }
  }
  return values;
}

/** Parses the text of a number input; empty or invalid input yields null (no value). */
export function parseNumberInput(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
