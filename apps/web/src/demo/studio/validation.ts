import {
  type BlockDefinition,
  customComponentBlockConfigSchema,
  type DefinitionIssue,
  type StudioDocument,
  studioDocumentSchema,
} from "@argus/schema";
import { DEMO_TABLES } from "../scenario.js";

type Path = (string | number)[];

/** What the validator may look up in the demo store (references are checked against it). */
export interface ValidationContext {
  /** Id of the definition being validated, when it already exists. */
  readonly selfId: string | null;
  /** Other pages' slugs (excluding `selfId`). */
  readonly otherPageSlugs: ReadonlySet<string>;
  readonly boardIds: ReadonlySet<string>;
  /** Versions of a component that were published (including later archived ones). */
  readonly publishedComponentVersions: (componentId: string) => ReadonlySet<number> | null;
}

const ALLOWED_IMPORTS = new Set(["react", "@argus/component-sdk"]);
const KNOWN_TABLES = new Set<string>(Object.values(DEMO_TABLES));

function toPath(path: readonly PropertyKey[]): Path {
  return path.map((segment) => (typeof segment === "number" ? segment : String(segment)));
}

function checkBlocks(
  blocks: readonly BlockDefinition[],
  base: Path,
  context: ValidationContext,
  issues: DefinitionIssue[],
): void {
  blocks.forEach((block, index) => {
    const at: Path = [...base, index];
    if (block.type === "custom-component") {
      const parsed = customComponentBlockConfigSchema.safeParse(block.config);
      if (!parsed.success) {
        issues.push({
          path: [...at, "config"],
          message: "Custom component block needs componentId, componentVersion and props.",
          severity: "error",
        });
        return;
      }
      const versions = context.publishedComponentVersions(parsed.data.componentId);
      if (!versions) {
        issues.push({
          path: [...at, "config", "componentId"],
          message: "Referenced component does not exist.",
          severity: "error",
        });
      } else if (!versions.has(parsed.data.componentVersion)) {
        issues.push({
          path: [...at, "config", "componentVersion"],
          message: `Component has no published version ${parsed.data.componentVersion}.`,
          severity: "error",
        });
      }
    }
    if (block.type === "board-embed") {
      const boardId = block.config.boardId;
      if (typeof boardId !== "string" || !context.boardIds.has(boardId)) {
        issues.push({
          path: [...at, "config", "boardId"],
          message: "Embedded board does not exist.",
          severity: "error",
        });
      }
    }
  });
}

function checkComponent(
  document: Extract<StudioDocument, { kind: "component" }>,
  issues: DefinitionIssue[],
): void {
  const { source, props, capabilities } = document.definition;
  for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier !== undefined && !ALLOWED_IMPORTS.has(specifier)) {
      issues.push({
        path: ["definition", "source"],
        message: `Import "${specifier}" is not allowed; components may import only react and @argus/component-sdk.`,
        severity: "error",
      });
    }
  }
  props.forEach((prop, index) => {
    if (prop.type === "enum" && prop.options.length === 0) {
      issues.push({
        path: ["definition", "props", index, "options"],
        message: "Enum props need at least one option.",
        severity: "error",
      });
    }
    if (prop.type !== "enum" && prop.options.length > 0) {
      issues.push({
        path: ["definition", "props", index, "options"],
        message: "Only enum props may declare options.",
        severity: "error",
      });
    }
  });
  capabilities.forEach((capability, index) => {
    if (capability.type === "outbound-http") return;
    if (capability.type === "workflow-action") return;
    capability.tableIds.forEach((tableId, tableIndex) => {
      if (!KNOWN_TABLES.has(tableId)) {
        issues.push({
          path: ["definition", "capabilities", index, "tableIds", tableIndex],
          message: "Capability references a table that does not exist in this demo.",
          severity: "warning",
        });
      }
    });
  });
}

/**
 * Demo `studio.validate`: schema validation (Zod paths) plus reference checks the real server
 * performs. Input: an unknown document. Output: issues; empty means valid.
 */
export function validateDocument(input: unknown, context: ValidationContext): DefinitionIssue[] {
  const parsed = studioDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      path: toPath(issue.path),
      message: issue.message || "Invalid value.",
      severity: "error" as const,
    }));
  }
  const document = parsed.data;
  const issues: DefinitionIssue[] = [];
  switch (document.kind) {
    case "board": {
      const { definition, layout } = document.bundle;
      const base: Path = ["bundle"];
      if (definition.layoutId !== layout.id) {
        issues.push({
          path: [...base, "definition", "layoutId"],
          message: "Board layoutId must match the bundled layout id.",
          severity: "error",
        });
      }
      const blockIds = new Set(definition.blocks.map((block) => block.id));
      if (blockIds.size !== definition.blocks.length) {
        issues.push({
          path: [...base, "definition", "blocks"],
          message: "Block ids must be unique.",
          severity: "error",
        });
      }
      layout.layouts.forEach((responsive, layoutIndex) => {
        responsive.items.forEach((item, itemIndex) => {
          if (!blockIds.has(item.blockId)) {
            issues.push({
              path: [...base, "layout", "layouts", layoutIndex, "items", itemIndex, "blockId"],
              message: "Layout item references a block that does not exist.",
              severity: "error",
            });
          }
        });
      });
      checkBlocks(definition.blocks, [...base, "definition", "blocks"], context, issues);
      break;
    }
    case "page": {
      const { slug, blocks } = document.definition;
      if (context.otherPageSlugs.has(slug)) {
        issues.push({
          path: ["definition", "slug"],
          message: `Another page already uses the slug "${slug}".`,
          severity: "error",
        });
      }
      checkBlocks(blocks, ["definition", "blocks"], context, issues);
      break;
    }
    case "component":
      checkComponent(document, issues);
      break;
  }
  return issues;
}
