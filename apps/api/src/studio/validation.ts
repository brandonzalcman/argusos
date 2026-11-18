import { type CelParserLimits, parseCel } from "@argus/expr";
import {
  type BlockDefinition,
  customComponentBlockConfigSchema,
  type DefinitionIssue,
  type Id,
  type StudioDocument,
  studioDocumentSchema,
} from "@argus/schema";

/** Read-only lookups validation needs, supplied inside the caller's tenant transaction. */
export interface StudioReferenceLookup {
  publishedBoardExists(boardId: Id): Promise<boolean>;
  publishedComponentVersionExists(componentId: Id, version: number): Promise<boolean>;
  /** Returns the subset of `positionIds` that exist in the caller's tenant. */
  existingPositions(positionIds: readonly Id[]): Promise<readonly Id[]>;
  /** Position ids that already own a published homepage page other than `excludePageId`. */
  positionsClaimedByOtherPage(
    positionIds: readonly Id[],
    excludePageId: Id | null,
  ): Promise<readonly Id[]>;
}

type Path = (string | number)[];

const MAX_ISSUES = 500;
const CEL_NOT_CHECKED_MESSAGE =
  "CEL expressions were not checked: the CEL parser is not implemented yet.";
const CEL_LIMITS: CelParserLimits = { maxSourceBytes: 80_000, maxAstDepth: 64, maxAstNodes: 5_000 };

function error(path: Path, message: string): DefinitionIssue {
  return { path, message: message.slice(0, 2_000), severity: "error" };
}

interface CelUse {
  readonly path: Path;
  readonly text: string;
  readonly use: "visibility" | "default";
}

function collectBlockCel(blocks: readonly BlockDefinition[], base: Path, out: CelUse[]): void {
  blocks.forEach((block, index) => {
    const at: Path = [...base, index];
    if (block.visibilityExpression !== null) {
      out.push({
        path: [...at, "visibilityExpression"],
        text: block.visibilityExpression,
        use: "visibility",
      });
    }
    if (block.access.visibilityRule !== null) {
      out.push({
        path: [...at, "access", "visibilityRule"],
        text: block.access.visibilityRule,
        use: "visibility",
      });
    }
    const action = block.action;
    if (action === null) return;
    if (action.type === "open-record") {
      out.push({
        path: [...at, "action", "recordIdExpression"],
        text: action.recordIdExpression,
        use: "default",
      });
    } else if (action.type === "run-workflow" && action.inputExpression !== null) {
      out.push({
        path: [...at, "action", "inputExpression"],
        text: action.inputExpression,
        use: "default",
      });
    } else if (action.type === "create-record" && action.defaultsExpression !== null) {
      out.push({
        path: [...at, "action", "defaultsExpression"],
        text: action.defaultsExpression,
        use: "default",
      });
    }
  });
}

function collectCel(document: StudioDocument): CelUse[] {
  const out: CelUse[] = [];
  if (document.kind === "component") {
    document.definition.props.forEach((prop, index) => {
      if (prop.type === "cel" && typeof prop.defaultValue === "string") {
        out.push({
          path: ["definition", "props", index, "defaultValue"],
          text: prop.defaultValue,
          use: "default",
        });
      }
    });
    return out;
  }
  const base: Path = document.kind === "board" ? ["bundle", "definition"] : ["definition"];
  const definition = document.kind === "board" ? document.bundle.definition : document.definition;
  definition.dataSources.forEach((source, index) => {
    if (source.filterExpression !== null) {
      out.push({
        path: [...base, "dataSources", index, "filterExpression"],
        text: source.filterExpression,
        use: "visibility",
      });
    }
  });
  if (document.kind === "board") {
    document.bundle.definition.views.forEach((view, index) => {
      if (view.access.visibilityRule !== null) {
        out.push({
          path: [...base, "views", index, "access", "visibilityRule"],
          text: view.access.visibilityRule,
          use: "visibility",
        });
      }
    });
  }
  if (definition.access.visibilityRule !== null) {
    out.push({
      path: [...base, "access", "visibilityRule"],
      text: definition.access.visibilityRule,
      use: "visibility",
    });
  }
  collectBlockCel(definition.blocks, [...base, "blocks"], out);
  return out;
}

/** Never executes anything: parseCel only builds an AST (and is a stub that throws TODO today). */
function celIssues(document: StudioDocument): DefinitionIssue[] {
  const uses = collectCel(document);
  if (uses.length === 0) return [];
  const definition = document.kind === "board" ? document.bundle.definition : document.definition;
  const issues: DefinitionIssue[] = [];
  for (const use of uses) {
    let result: ReturnType<typeof parseCel>;
    try {
      result = parseCel(
        {
          definitionId: definition.id,
          revision: definition.version,
          text: use.text,
          use: use.use,
        },
        CEL_LIMITS,
      );
    } catch (caught) {
      if (caught instanceof Error && caught.message.startsWith("TODO(implementation)")) {
        return [{ path: [], message: CEL_NOT_CHECKED_MESSAGE, severity: "warning" }];
      }
      throw caught;
    }
    for (const diagnostic of result.diagnostics) {
      issues.push({
        path: use.path,
        message: diagnostic.message.slice(0, 2_000) || "Invalid CEL expression.",
        severity: diagnostic.severity,
      });
    }
    if (!result.ok && !result.diagnostics.some((d) => d.severity === "error")) {
      issues.push(error(use.path, "The CEL expression could not be parsed."));
    }
  }
  return issues;
}

async function blockIssues(
  document: StudioDocument,
  lookup: StudioReferenceLookup,
): Promise<DefinitionIssue[]> {
  if (document.kind === "component") return [];
  const blocks =
    document.kind === "board" ? document.bundle.definition.blocks : document.definition.blocks;
  const base: Path =
    document.kind === "board" ? ["bundle", "definition", "blocks"] : ["definition", "blocks"];
  const issues: DefinitionIssue[] = [];
  for (const [index, block] of blocks.entries()) {
    const at: Path = [...base, index];
    if (block.type === "board-embed") {
      if (document.kind === "board") {
        issues.push(error([...at, "type"], "board-embed blocks are only supported on pages."));
        continue;
      }
      const boardId: unknown = block.config.boardId;
      if (typeof boardId !== "string") {
        issues.push(error([...at, "config", "boardId"], "board-embed requires config.boardId."));
      } else if (!(await lookup.publishedBoardExists(boardId))) {
        issues.push(
          error(
            [...at, "config", "boardId"],
            "The embedded board does not exist or is not published.",
          ),
        );
      }
    } else if (block.type === "custom-component") {
      const parsed = customComponentBlockConfigSchema.safeParse(block.config);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push(
            error(
              [...at, "config", ...issue.path.map((p) => (typeof p === "symbol" ? String(p) : p))],
              issue.message,
            ),
          );
        }
      } else if (
        !(await lookup.publishedComponentVersionExists(
          parsed.data.componentId,
          parsed.data.componentVersion,
        ))
      ) {
        issues.push(
          error(
            [...at, "config", "componentVersion"],
            "The pinned component version does not exist or is not published.",
          ),
        );
      }
    }
  }
  return issues;
}

function boardIssues(document: Extract<StudioDocument, { kind: "board" }>): DefinitionIssue[] {
  const { definition, layout } = document.bundle;
  const issues: DefinitionIssue[] = [];
  if (layout.boardId !== definition.id) {
    issues.push(error(["bundle", "layout", "boardId"], "The layout must reference this board."));
  }
  if (definition.layoutId !== layout.id) {
    issues.push(
      error(["bundle", "definition", "layoutId"], "The board must reference its bundled layout."),
    );
  }
  const blockIds = new Set<string>();
  definition.blocks.forEach((block, index) => {
    if (blockIds.has(block.id)) {
      issues.push(
        error(["bundle", "definition", "blocks", index, "id"], "Block ids must be unique."),
      );
    }
    blockIds.add(block.id);
  });
  const breakpoints = new Set<string>();
  layout.layouts.forEach((responsive, layoutIndex) => {
    if (breakpoints.has(responsive.breakpoint)) {
      issues.push(
        error(
          ["bundle", "layout", "layouts", layoutIndex, "breakpoint"],
          `Duplicate layout for breakpoint "${responsive.breakpoint}".`,
        ),
      );
    }
    breakpoints.add(responsive.breakpoint);
    responsive.items.forEach((item, itemIndex) => {
      if (!blockIds.has(item.blockId)) {
        issues.push(
          error(
            ["bundle", "layout", "layouts", layoutIndex, "items", itemIndex, "blockId"],
            "Layout item references a block that does not exist.",
          ),
        );
      }
    });
  });
  return issues;
}

async function pageIssues(
  document: Extract<StudioDocument, { kind: "page" }>,
  lookup: StudioReferenceLookup,
): Promise<DefinitionIssue[]> {
  const page = document.definition;
  const issues: DefinitionIssue[] = [];
  const seen = new Set<string>();
  const unique: Id[] = [];
  page.homepageForPositionIds.forEach((positionId, index) => {
    if (seen.has(positionId)) {
      issues.push(
        error(["definition", "homepageForPositionIds", index], "Duplicate homepage position."),
      );
      return;
    }
    seen.add(positionId);
    unique.push(positionId);
  });
  if (unique.length === 0) return issues;
  const existing = new Set(await lookup.existingPositions(unique));
  const claimed = new Set(await lookup.positionsClaimedByOtherPage(unique, page.id));
  page.homepageForPositionIds.forEach((positionId, index) => {
    if (!existing.has(positionId)) {
      issues.push(
        error(["definition", "homepageForPositionIds", index], "The position does not exist."),
      );
    } else if (claimed.has(positionId)) {
      issues.push(
        error(
          ["definition", "homepageForPositionIds", index],
          "The position already has another published page as its homepage.",
        ),
      );
    }
  });
  return issues;
}

function componentIssues(
  document: Extract<StudioDocument, { kind: "component" }>,
): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  const keys = new Set<string>();
  document.definition.props.forEach((prop, index) => {
    if (keys.has(prop.key)) {
      issues.push(error(["definition", "props", index, "key"], "Prop keys must be unique."));
    }
    keys.add(prop.key);
    if (prop.type !== "enum" && prop.options.length > 0) {
      issues.push(
        error(
          ["definition", "props", index, "options"],
          "Options are only allowed for enum props.",
        ),
      );
    }
  });
  return issues;
}

/**
 * Validate a studio document: schema, cross-references (via `lookup`) and a CEL notice. Never
 * executes document content; component source is only length-checked by the schema.
 * Errors: throws only for infrastructure failures, never for invalid documents.
 */
export async function validateStudioDocument(
  document: unknown,
  lookup: StudioReferenceLookup,
): Promise<DefinitionIssue[]> {
  const parsed = studioDocumentSchema.safeParse(document);
  if (!parsed.success) {
    return parsed.error.issues.slice(0, MAX_ISSUES).map((issue) =>
      error(
        issue.path.map((p) => (typeof p === "symbol" ? String(p) : p)),
        issue.message || "Invalid value.",
      ),
    );
  }
  const doc = parsed.data;
  const issues: DefinitionIssue[] = [];
  switch (doc.kind) {
    case "board":
      issues.push(...boardIssues(doc));
      break;
    case "page":
      issues.push(...(await pageIssues(doc, lookup)));
      break;
    case "component":
      issues.push(...componentIssues(doc));
      break;
  }
  issues.push(...(await blockIssues(doc, lookup)));
  issues.push(...celIssues(doc));
  return issues.slice(0, MAX_ISSUES);
}
