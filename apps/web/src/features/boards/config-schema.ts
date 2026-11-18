import type { BlockConfigByKind } from "@argus/blocks";
import type { BlockConfig, BlockKind } from "./model.js";

/**
 * Inspector field descriptors per block kind. The `key` of every descriptor is type-checked
 * against the public block configuration contract in @argus/blocks (BlockConfigByKind), so a
 * contract change breaks the build here instead of silently drifting.
 */
export type ConfigFieldInput =
  | { readonly input: "text" }
  | { readonly input: "textarea" }
  | { readonly input: "number"; readonly min: number; readonly max: number }
  | { readonly input: "boolean" }
  | {
      readonly input: "select";
      readonly options: readonly { readonly value: string; readonly label: string }[];
    }
  | { readonly input: "text-list" }
  | { readonly input: "json" };

export type ConfigField<K extends BlockKind> = ConfigFieldInput & {
  readonly key: keyof BlockConfigByKind[K] & string;
  readonly label: string;
  readonly help?: string;
  readonly required: boolean;
};

type AnyConfigField = ConfigField<BlockKind>;

const text = <K extends BlockKind>(
  key: keyof BlockConfigByKind[K] & string,
  label: string,
  required: boolean,
  help?: string,
): ConfigField<K> =>
  help ? { key, label, required, help, input: "text" } : { key, label, required, input: "text" };

const bool = <K extends BlockKind>(
  key: keyof BlockConfigByKind[K] & string,
  label: string,
): ConfigField<K> => ({ key, label, required: false, input: "boolean" });

export const blockConfigFields: { readonly [K in BlockKind]: readonly ConfigField<K>[] } = {
  "field-input": [
    text("fieldId", "Field", true, "Field definition id; labels come from the field definition."),
    text("label", "Label override", false),
    bool("required", "Required"),
  ],
  "field-display": [
    text("fieldId", "Field", true),
    text("label", "Label override", false),
    {
      key: "redactionBehavior",
      label: "When the field is hidden",
      required: true,
      input: "select",
      options: [
        { value: "hide", label: "Render nothing" },
        { value: "placeholder", label: "Show a redaction placeholder" },
      ],
    },
  ],
  "record-list": [
    text("tableId", "Table", true, "Must be one of the board data sources."),
    text("viewId", "Saved view", false),
    { key: "pageSize", label: "Page size", required: true, input: "number", min: 1, max: 200 },
  ],
  "related-records": [text("relationId", "Relation", true), text("viewId", "Saved view", false)],
  stat: [
    text("tableId", "Table", true),
    text("aggregationDefinitionId", "Aggregation", true),
    text("label", "Label", true),
  ],
  chart: [text("tableId", "Table", true), text("chartDefinitionId", "Chart definition", true)],
  map: [
    { key: "layerDefinitionIds", label: "Layers", required: false, input: "text-list" },
    text("initialViewportId", "Initial viewport", false),
  ],
  timeline: [
    text("tableId", "Table", true),
    text("startFieldId", "Start field", true),
    text("endFieldId", "End field", false),
  ],
  "rich-text": [
    {
      key: "contentDocument",
      label: "Content (plain text)",
      required: false,
      input: "textarea",
      help: "TODO(decision): rich-text document format; rendered as plain text only.",
    },
  ],
  image: [text("attachmentId", "Attachment", true), text("altText", "Alternative text", true)],
  button: [
    text("label", "Label", true),
    text("actionDefinitionId", "Action", true),
    bool("confirmationRequired", "Require confirmation"),
  ],
  tabs: [
    {
      key: "tabs",
      label: "Tabs (JSON)",
      required: true,
      input: "json",
      help: 'Array of { "id", "label", "blockIds" }.',
    },
  ],
  section: [
    text("title", "Title", true),
    bool("collapsible", "Collapsible"),
    bool("initiallyExpanded", "Initially expanded"),
  ],
  divider: [
    {
      key: "orientation",
      label: "Orientation",
      required: true,
      input: "select",
      options: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical", label: "Vertical" },
      ],
    },
  ],
  embed: [
    text("embedDefinitionId", "Embed definition", true),
    text(
      "allowlistedOrigin",
      "Allow-listed origin",
      true,
      "Exact origin, e.g. https://example.org",
    ),
  ],
  comments: [text("recordId", "Record", true)],
  checklist: [text("checklistDefinitionId", "Checklist definition", true)],
  "attachment-gallery": [text("recordId", "Record", true), text("fieldId", "Field", true)],
  countdown: [text("targetFieldId", "Target field", false), text("timeZone", "Time zone", true)],
  weather: [
    text("feedDefinitionId", "Weather feed", true),
    text("locationFieldId", "Location field", true),
  ],
  "board-embed": [
    text("boardId", "Board", true, "Published board to embed. Viewers still need access to it."),
    text("viewId", "View", false),
    bool("showHeader", "Show board header"),
  ],
  "link-list": [
    text("title", "Title", false),
    {
      key: "layout",
      label: "Layout",
      required: true,
      input: "select",
      options: [
        { value: "list", label: "List" },
        { value: "grid", label: "Grid" },
      ],
    },
    { key: "links", label: "Links", required: false, input: "json" },
  ],
  // TODO(implementation): the component picker and generated prop controls replace these fields.
  "custom-component": [
    text("componentId", "Component", true),
    {
      key: "componentVersion",
      label: "Version",
      required: true,
      input: "number",
      min: 1,
      max: 1_000_000,
    },
    { key: "props", label: "Props", required: false, input: "json" },
  ],
};

/** Configuration written to a freshly added block: required toggles/selects get safe defaults. */
export function defaultConfig(kind: BlockKind): BlockConfig {
  switch (kind) {
    case "field-input":
      return { required: false };
    case "field-display":
      return { redactionBehavior: "hide" };
    case "record-list":
      return { pageSize: 25 };
    case "tabs":
      return { tabs: [] };
    case "section":
      return { title: "Section", collapsible: true, initiallyExpanded: true };
    case "divider":
      return { orientation: "horizontal" };
    case "button":
      return { confirmationRequired: true };
    case "countdown":
      return { timeZone: "UTC" };
    case "map":
      return { layerDefinitionIds: [] };
    case "board-embed":
      return { showHeader: true };
    case "link-list":
      return { layout: "list", links: [] };
    case "custom-component":
      return { props: {} };
    default:
      return {};
  }
}

export interface ConfigIssue {
  readonly key: string;
  readonly message: string;
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === "string" && value.trim() === "")
  );
}

/** Local completeness check; the server remains authoritative via the shared Zod schemas. */
export function validateConfig(kind: BlockKind, config: BlockConfig): readonly ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  for (const field of blockConfigFields[kind] as readonly AnyConfigField[]) {
    const value = config[field.key];
    if (field.required && field.input !== "boolean" && isBlank(value)) {
      issues.push({ key: field.key, message: `${field.label} is required.` });
      continue;
    }
    if (field.input === "number" && !isBlank(value)) {
      if (typeof value !== "number" || value < field.min || value > field.max) {
        issues.push({
          key: field.key,
          message: `${field.label} must be between ${field.min} and ${field.max}.`,
        });
      }
    }
  }
  if (kind === "embed" && typeof config.allowlistedOrigin === "string") {
    try {
      const url = new URL(config.allowlistedOrigin);
      if (url.protocol !== "https:" || url.origin !== config.allowlistedOrigin) {
        issues.push({ key: "allowlistedOrigin", message: "Use an exact https origin." });
      }
    } catch {
      issues.push({ key: "allowlistedOrigin", message: "Use an exact https origin." });
    }
  }
  return issues;
}

/** Returns a copy of `config` with `key` set; blank optional values are removed from the document. */
export function setConfigValue(
  config: BlockConfig,
  key: string,
  value: BlockConfig[string] | undefined,
): BlockConfig {
  const next: Record<string, BlockConfig[string]> = { ...config };
  if (value === undefined || value === "") {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}
