import type {
  BlockDefinition,
  CustomComponentDefinition,
  LayoutItem,
  PageDefinition,
  StudioDocument,
} from "@argus/schema";
import { createInitialVersions } from "../boards/definitions.js";
import {
  DEMO_BOARDS,
  DEMO_POSITIONS,
  DEMO_TABLES,
  DEMO_TENANT_ID,
  DEMO_USERS,
  minutesAgo,
} from "../scenario.js";

/*
 * Seed data for the demo studio. Every page, component, name and number is FICTIONAL (the Harlow
 * River flood scenario for the invented "Northbank County Emergency Management").
 */

export const DEMO_PAGES = {
  dutyOfficer: "a1000000-0000-4000-8000-000000000001",
  publicInfo: "a1000000-0000-4000-8000-000000000002",
  draftOnly: "a1000000-0000-4000-8000-000000000003",
} as const;

export const DEMO_COMPONENTS = {
  shelterCapacityGauge: "c1000000-0000-4000-8000-000000000001",
} as const;

/** Field ids of the demo Shelters table (see ../tables/definitions.ts: group f1000002, fields 3 and 4). */
export const DEMO_SHELTER_FIELDS = {
  capacity: "f1000002-0000-4000-8000-000000000003",
  occupancy: "f1000002-0000-4000-8000-000000000004",
} as const;

const OPEN = { positionIds: [], visibilityRule: null };

function blockUuid(page: number, n: number): string {
  return `a1${page}00000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function block(
  id: string,
  type: BlockDefinition["type"],
  name: string,
  config: BlockDefinition["config"],
): BlockDefinition {
  return { id, type, name, config, visibilityExpression: null, action: null, access: OPEN };
}

function stat(id: string, label: string, tableId: string, key: string): BlockDefinition {
  return block(id, "stat", label, { tableId, aggregationDefinitionId: `count-${key}`, label });
}

function place(blockId: string, x: number, y: number, width: number, height: number): LayoutItem {
  return { blockId, x, y, width, height, hidden: false };
}

function stacked(items: readonly LayoutItem[]): LayoutItem[] {
  let y = 0;
  return [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => {
      const placed = { ...item, x: 0, y, width: 12 };
      y += item.height;
      return placed;
    });
}

interface PageRecipe {
  readonly id: string;
  readonly key: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly blocks: readonly BlockDefinition[];
  readonly items: readonly LayoutItem[];
  readonly lifecycle: "draft" | "published";
  readonly version: number;
  readonly changeSummary: string | null;
  readonly createdAgoMinutes: number;
  readonly publishedAgoMinutes: number | null;
  readonly createdBy: string;
}

/** One data source per table referenced by a block config (aliases derived from DEMO_TABLES names). */
function pageSources(blocks: readonly BlockDefinition[]): PageDefinition["dataSources"] {
  const names = new Map<string, string>(
    Object.entries(DEMO_TABLES).map(([name, id]) => [
      id,
      name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
    ]),
  );
  const tableIds = new Set<string>();
  for (const item of blocks) {
    const tableId = item.config.tableId;
    if (typeof tableId === "string") tableIds.add(tableId);
  }
  return [...tableIds].map((tableId, index) => ({
    alias: names.get(tableId) ?? `source_${index + 1}`,
    tableId,
    filterExpression: null,
  }));
}

function buildPage(recipe: PageRecipe): PageDefinition {
  const publishedAt =
    recipe.publishedAgoMinutes === null ? null : minutesAgo(recipe.publishedAgoMinutes);
  return {
    id: recipe.id,
    tenantId: DEMO_TENANT_ID,
    version: recipe.version,
    lifecycle: recipe.lifecycle,
    changeSummary: recipe.changeSummary,
    createdAt: minutesAgo(recipe.createdAgoMinutes),
    createdBy: recipe.createdBy,
    createdPositionId: DEMO_POSITIONS.incidentCommander,
    publishedAt,
    publishedBy: publishedAt ? recipe.createdBy : null,
    key: recipe.key,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    icon: recipe.icon,
    dataSources: pageSources(recipe.blocks),
    blocks: [...recipe.blocks],
    layouts: [
      { breakpoint: "desktop", items: [...recipe.items] },
      { breakpoint: "phone", items: stacked(recipe.items) },
    ],
    homepageForPositionIds: [],
    access: OPEN,
  };
}

const D = (n: number): string => blockUuid(1, n);
const dutyOfficerBlocks = [
  stat(D(1), "Open resource requests", DEMO_TABLES.resourceRequests, "requests"),
  stat(D(2), "Shelters", DEMO_TABLES.shelters, "shelters"),
  stat(D(3), "Road closures", DEMO_TABLES.roadClosures, "closures"),
  block(D(4), "board-embed", "Command overview", {
    boardId: DEMO_BOARDS.commandOverview,
    showHeader: false,
  }),
  block(D(5), "link-list", "Quick links", {
    title: "Quick links",
    layout: "list",
    links: [
      {
        label: "Shelter status board",
        target: { type: "board", boardId: DEMO_BOARDS.shelterStatus },
      },
      { label: "Logistics board", target: { type: "board", boardId: DEMO_BOARDS.logistics } },
      { label: "Public information desk", target: { type: "page", pageId: DEMO_PAGES.publicInfo } },
    ],
  }),
];

const P = (n: number): string => blockUuid(2, n);
const publicInfoBlocks = [
  block(P(1), "rich-text", "Public advisory", {
    contentDocument:
      "Fictional demo advisory: residents of Harlow Flats should follow evacuation routes posted by Northbank County. Shelters accept pets at selected sites. This text is invented for the demo.",
  }),
  block(P(2), "link-list", "Where to get help", {
    title: "Where to get help",
    layout: "grid",
    links: [
      { label: "Shelter status", target: { type: "board", boardId: DEMO_BOARDS.shelterStatus } },
      {
        label: "County alerts (example site)",
        target: { type: "url", url: "https://example.org/alerts" },
      },
    ],
  }),
];

const S = (n: number): string => blockUuid(3, n);
const draftBlocks = [
  block(S(1), "rich-text", "Draft briefing", {
    contentDocument:
      "Fictional draft: end-of-period briefing for operational period 5. Not published yet.",
  }),
];

const pageRecipes: readonly PageRecipe[] = [
  {
    id: DEMO_PAGES.dutyOfficer,
    key: "duty_officer_overview",
    slug: "duty-officer",
    title: "Duty officer overview",
    description: "Key counts, the command overview board and quick links for the duty officer.",
    icon: "layout-dashboard",
    blocks: dutyOfficerBlocks,
    items: [
      place(D(1), 0, 0, 4, 2),
      place(D(2), 4, 0, 4, 2),
      place(D(3), 8, 0, 4, 2),
      place(D(4), 0, 2, 8, 8),
      place(D(5), 8, 2, 4, 8),
    ],
    lifecycle: "published",
    version: 1,
    changeSummary: "Initial duty officer overview.",
    createdAgoMinutes: 2_000,
    publishedAgoMinutes: 1_990,
    createdBy: DEMO_USERS.priyaShah,
  },
  {
    id: DEMO_PAGES.publicInfo,
    key: "public_information_desk",
    slug: "public-info",
    title: "Public information desk",
    description: "Advisory text and links prepared by the Public Information Officer.",
    icon: "megaphone",
    blocks: publicInfoBlocks,
    items: [place(P(1), 0, 0, 12, 3), place(P(2), 0, 3, 12, 4)],
    lifecycle: "published",
    version: 1,
    changeSummary: "First public information page.",
    createdAgoMinutes: 1_200,
    publishedAgoMinutes: 1_180,
    createdBy: DEMO_USERS.caseyNguyen,
  },
  {
    id: DEMO_PAGES.draftOnly,
    key: "end_of_period_briefing",
    slug: "end-of-period-briefing",
    title: "End of period briefing",
    description: "Work in progress; never published.",
    icon: "clipboard-list",
    blocks: draftBlocks,
    items: [place(S(1), 0, 0, 12, 4)],
    lifecycle: "draft",
    version: 1,
    changeSummary: null,
    createdAgoMinutes: 45,
    publishedAgoMinutes: null,
    createdBy: DEMO_USERS.alexMorgan,
  },
];

/**
 * Source of the seeded custom component. FICTIONAL demo code: renders shelter occupancy against
 * capacity from the bound table, or an empty state when no data is available.
 */
export const SHELTER_CAPACITY_GAUGE_SOURCE = `import React from "react";
import { Badge, Card, EmptyState, Stack, Text, useProps, useRecords } from "@argus/component-sdk";

interface Props {
  table_id?: string;
  capacity_field?: string;
  occupancy_field?: string;
  title?: string;
}

export default function ShelterCapacityGauge() {
  const props = useProps<Props>();
  const records = useRecords({ tableId: props.table_id ?? "", limit: 100 });
  const capacityKey = props.capacity_field ?? "capacity";
  const occupancyKey = props.occupancy_field ?? "occupancy";

  if (!props.table_id || records.status === "loading") {
    return (
      <Card>
        <EmptyState
          title={props.table_id ? "Loading shelter data" : "Choose a table"}
          description={props.table_id ? undefined : "Set the table_id prop to a shelter table."}
        />
      </Card>
    );
  }

  const rows = records.data
    .map((record) => ({
      capacity: Number(record.values[capacityKey]),
      occupancy: Number(record.values[occupancyKey]),
    }))
    .filter((row) => Number.isFinite(row.capacity) && Number.isFinite(row.occupancy));

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState title="No shelter data" description="No readable capacity or occupancy values." />
      </Card>
    );
  }

  const capacity = rows.reduce((sum, row) => sum + row.capacity, 0);
  const occupancy = rows.reduce((sum, row) => sum + row.occupancy, 0);
  const percent = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;
  const tone = percent >= 90 ? "critical" : percent >= 75 ? "warning" : "success";

  return (
    <Card>
      <Stack gap={2}>
        <Text weight="bold">{props.title ?? "Shelter capacity"}</Text>
        <Stack direction="row" gap={2} align="center">
          <Text size="lg" weight="bold">{percent}%</Text>
          <Badge tone={tone}>{occupancy} of {capacity} beds</Badge>
        </Stack>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          style={{ background: "#e5e7eb", borderRadius: 4, height: 8 }}
        >
          <div style={{ background: "currentColor", borderRadius: 4, height: 8, width: percent + "%" }} />
        </div>
      </Stack>
    </Card>
  );
}
`;

function buildGauge(): CustomComponentDefinition {
  const prop = (
    key: string,
    label: string,
    type: "table" | "field" | "string",
    defaultValue: string,
    required: boolean,
  ) => ({ key, label, description: null, type, required, defaultValue, options: [] });
  return {
    id: DEMO_COMPONENTS.shelterCapacityGauge,
    tenantId: DEMO_TENANT_ID,
    version: 1,
    lifecycle: "published",
    changeSummary: "Initial shelter capacity gauge.",
    createdAt: minutesAgo(1_600),
    createdBy: DEMO_USERS.jordanLee,
    createdPositionId: DEMO_POSITIONS.incidentCommander,
    publishedAt: minutesAgo(1_590),
    publishedBy: DEMO_USERS.jordanLee,
    key: "shelter_capacity_gauge",
    name: "Shelter capacity gauge",
    description: "Occupancy versus capacity for a shelter table (fictional demo component).",
    language: "tsx",
    source: SHELTER_CAPACITY_GAUGE_SOURCE,
    props: [
      prop("table_id", "Shelter table", "table", DEMO_TABLES.shelters, true),
      prop("capacity_field", "Capacity field", "field", DEMO_SHELTER_FIELDS.capacity, true),
      prop("occupancy_field", "Occupancy field", "field", DEMO_SHELTER_FIELDS.occupancy, true),
      prop("title", "Title", "string", "Shelter capacity", false),
    ],
    capabilities: [
      {
        type: "read-records",
        tableIds: [DEMO_TABLES.shelters],
        fieldIds: [DEMO_SHELTER_FIELDS.capacity, DEMO_SHELTER_FIELDS.occupancy],
      },
    ],
    ejectedFrom: null,
    sdkVersion: 1,
  };
}

/** Every seeded definition's version history (oldest first), as documents carrying their own metadata. */
export function createSeedHistories(): StudioDocument[][] {
  const histories: StudioDocument[][] = [];
  for (const versions of createInitialVersions().values()) {
    histories.push(
      versions.map((bundle) => ({
        kind: "board" as const,
        bundle: structuredClone(bundle) as Extract<StudioDocument, { kind: "board" }>["bundle"],
      })),
    );
  }
  for (const recipe of pageRecipes) {
    histories.push([{ kind: "page", definition: buildPage(recipe) }]);
  }
  histories.push([{ kind: "component", definition: buildGauge() }]);
  return histories;
}
