import type {
  BlockDefinition,
  BlockType,
  CustomComponentDefinition,
  DefinitionMetadata,
  PageDefinition,
  StudioDocument,
} from "@argus/schema";
import { DEMO_TABLES, DEMO_TENANT_ID, demoId } from "../scenario.js";
import { createDemoTables, createDemoViews } from "../tables/definitions.js";

/*
 * Document helpers and creation templates for the demo studio (all data FICTIONAL).
 */

type BoardDocument = Extract<StudioDocument, { kind: "board" }>;
type MetaPatch = Partial<Omit<DefinitionMetadata, "id">>;

/** The versioned definition inside a document (the board definition for board bundles). */
function definitionOf(
  document: StudioDocument,
): BoardDocument["bundle"]["definition"] | PageDefinition | CustomComponentDefinition {
  return document.kind === "board" ? document.bundle.definition : document.definition;
}

export function metaOf(document: StudioDocument): DefinitionMetadata {
  const definition = definitionOf(document);
  return {
    id: definition.id,
    version: definition.version,
    lifecycle: definition.lifecycle,
    changeSummary: definition.changeSummary,
    createdAt: definition.createdAt,
    createdBy: definition.createdBy,
    createdPositionId: definition.createdPositionId,
    publishedAt: definition.publishedAt,
    publishedBy: definition.publishedBy,
  };
}

/** Name, key and slug as the catalog shows them. */
export function infoOf(document: StudioDocument): {
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly slug: string | null;
} {
  switch (document.kind) {
    case "board": {
      const { key, name, description } = document.bundle.definition;
      return { key, name, description, slug: null };
    }
    case "page": {
      const { key, title, description, slug } = document.definition;
      return { key, name: title, description, slug };
    }
    case "component": {
      const { key, name, description } = document.definition;
      return { key, name, description, slug: null };
    }
  }
}

/** Returns a copy of `document` with server-owned metadata patched (boards: definition and layout). */
export function withMeta(document: StudioDocument, patch: MetaPatch): StudioDocument {
  const copy = structuredClone(document);
  Object.assign(definitionOf(copy), patch, { tenantId: DEMO_TENANT_ID });
  if (copy.kind === "board") {
    Object.assign(copy.bundle.layout, patch, { tenantId: DEMO_TENANT_ID });
  }
  return copy;
}

/** Stable text of a document's authored content, ignoring server-owned revision metadata. */
export function contentKey(document: StudioDocument): string {
  const neutral = withMeta(document, {
    version: 1,
    lifecycle: "draft",
    changeSummary: null,
    createdAt: "1970-01-01T00:00:00.000Z",
    createdBy: DEMO_TENANT_ID,
    createdPositionId: DEMO_TENANT_ID,
    publishedAt: null,
    publishedBy: null,
  });
  return JSON.stringify(neutral);
}

/** Lowercase hyphenated slug from a snake_case definition key. */
export function slugFromKey(key: string): string {
  return key.replace(/_+/g, "-").replace(/^-+|-+$/g, "") || "page";
}

export interface NewMeta {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly createdPositionId: string;
}

const OPEN = { positionIds: [], visibilityRule: null };

function freshMeta(id: string, meta: NewMeta) {
  return {
    id,
    tenantId: DEMO_TENANT_ID,
    version: 1,
    lifecycle: "draft" as const,
    changeSummary: null,
    createdAt: meta.createdAt,
    createdBy: meta.createdBy,
    createdPositionId: meta.createdPositionId,
    publishedAt: null,
    publishedBy: null,
  };
}

function recordListBlock(tableId: string, name: string): BlockDefinition {
  return {
    id: demoId(),
    type: "record-list",
    name,
    config: { tableId, pageSize: 10 },
    visibilityExpression: null,
    action: null,
    access: OPEN,
  };
}

function introBlock(text: string): BlockDefinition {
  return {
    id: demoId(),
    type: "rich-text",
    name: "Introduction",
    config: { contentDocument: text },
    visibilityExpression: null,
    action: null,
    access: OPEN,
  };
}

/** A demo table and the first saved view that board data sources need (boards require >= 1 view). */
function demoTableWithView(tableId: string): {
  readonly key: string;
  readonly name: string;
  readonly viewId: string;
} {
  const table = createDemoTables().find((candidate) => candidate.id === tableId);
  if (!table) throw new Error(`template-invalid: table ${tableId} not found`);
  const view = createDemoViews().get(tableId)?.[0];
  if (!view) throw new Error(`template-invalid: table ${table.name} has no saved view`);
  return { key: table.key, name: table.name, viewId: view.id };
}

export function blankBoard(
  key: string,
  name: string,
  meta: NewMeta,
  tableId: string = DEMO_TABLES.shelters,
  blocks: readonly BlockDefinition[] = [],
): StudioDocument {
  const source = demoTableWithView(tableId);
  const boardId = demoId();
  const layoutId = demoId();
  const placed = blocks.map((block, index) => ({
    blockId: block.id,
    x: 0,
    y: index * 6,
    width: 12,
    height: 6,
    hidden: false,
  }));
  return {
    kind: "board",
    bundle: {
      definition: {
        ...freshMeta(boardId, meta),
        key,
        name,
        description: null,
        dataSources: [{ alias: source.key, tableId, filterExpression: null }],
        views: [{ id: demoId(), viewId: source.viewId, name: "Board", access: OPEN }],
        blocks: [...blocks],
        layoutId,
        access: OPEN,
      },
      layout: {
        ...freshMeta(layoutId, meta),
        name: `${name} layout`,
        boardId,
        positionId: null,
        columns: 12,
        layouts: [
          { breakpoint: "desktop", items: placed },
          { breakpoint: "phone", items: placed },
        ],
      },
    },
  };
}

export function blankPage(
  key: string,
  name: string,
  slug: string,
  meta: NewMeta,
  blocks?: readonly BlockDefinition[],
  dataSources: PageDefinition["dataSources"] = [],
): StudioDocument {
  const content = blocks ?? [introBlock("Start building this page. (Fictional demo content.)")];
  const items = content.map((block, index) => ({
    blockId: block.id,
    x: 0,
    y: index * 6,
    width: 12,
    height: 6,
    hidden: false,
  }));
  return {
    kind: "page",
    definition: {
      ...freshMeta(demoId(), meta),
      key,
      slug,
      title: name,
      description: null,
      icon: null,
      dataSources,
      blocks: [...content],
      layouts: [
        { breakpoint: "desktop", items },
        { breakpoint: "phone", items },
      ],
      homepageForPositionIds: [],
      access: OPEN,
    },
  };
}

/**
 * TODO(implementation): replace with `getBlockTemplate(blockType)` from @argus/sdk once it exists
 * (it is not exported yet, so this placeholder keeps eject-block usable in demo mode).
 * Input: built-in block type. Output: editable TSX source approximating that block.
 * Errors: none. Depends on: @argus/sdk block templates.
 */
export function placeholderBlockTemplate(blockType: BlockType): string {
  return `import React from "react";
import { Card, Text, useProps } from "@argus/component-sdk";

// TODO(implementation): this is a placeholder for the built-in "${blockType}" block.
// The real ejected source will come from @argus/sdk getBlockTemplate("${blockType}").
export default function Ejected${blockType.replace(/(^|-)([a-z])/g, (_m, _d, c: string) => c.toUpperCase())}() {
  const props = useProps<{ title?: string }>();
  return (
    <Card>
      <Text weight="bold">{props.title ?? "${blockType}"}</Text>
    </Card>
  );
}
`;
}

export function blankComponent(
  key: string,
  name: string,
  meta: NewMeta,
  source?: string,
  ejectedFrom: BlockType | null = null,
): StudioDocument {
  return {
    kind: "component",
    definition: {
      ...freshMeta(demoId(), meta),
      key,
      name,
      description: null,
      language: "tsx",
      source:
        source ??
        `import React from "react";
import { Card, Text } from "@argus/component-sdk";

export default function Component() {
  return (
    <Card>
      <Text>Hello from a custom component (fictional demo).</Text>
    </Card>
  );
}
`,
      props: [],
      capabilities: [],
      ejectedFrom,
      sdkVersion: 1,
    },
  };
}

/** Board or page with one record-list block bound to a demo table. */
export function fromTable(
  kind: "board" | "page",
  key: string,
  name: string,
  slug: string,
  tableId: string,
  meta: NewMeta,
): StudioDocument {
  const table = demoTableWithView(tableId);
  const list = recordListBlock(tableId, `${table.name} list`);
  return kind === "board"
    ? blankBoard(key, name, meta, tableId, [list])
    : blankPage(
        key,
        name,
        slug,
        meta,
        [list],
        [{ alias: table.key, tableId, filterExpression: null }],
      );
}

/** Copy of `source` as a fresh version-1 draft with new ids, key and name. */
export function duplicateDocument(
  source: StudioDocument,
  key: string,
  name: string,
  slug: string,
  meta: NewMeta,
): StudioDocument {
  const copy = structuredClone(source);
  const patch = freshMeta(demoId(), meta);
  switch (copy.kind) {
    case "board": {
      const layoutId = demoId();
      Object.assign(copy.bundle.definition, patch, { key, name, layoutId });
      Object.assign(copy.bundle.layout, freshMeta(layoutId, meta), {
        boardId: patch.id,
        name: `${name} layout`,
      });
      break;
    }
    case "page":
      Object.assign(copy.definition, patch, {
        key,
        slug,
        title: name,
        homepageForPositionIds: [],
      });
      break;
    case "component":
      Object.assign(copy.definition, patch, { key, name });
      break;
  }
  return copy;
}
