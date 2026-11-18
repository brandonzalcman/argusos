import type {
  BlockDefinition,
  BoardBundle,
  BoardDefinition,
  LayoutDefinition,
  LayoutItem,
} from "../../features/boards/model.js";
import {
  DEMO_ACTOR,
  DEMO_BOARDS,
  DEMO_POSITIONS,
  DEMO_TABLES,
  DEMO_TENANT_ID,
  DEMO_USERS,
  minutesAgo,
} from "../scenario.js";

type BoardId = (typeof DEMO_BOARDS)[keyof typeof DEMO_BOARDS];

function openAccess(): { positionIds: string[]; visibilityRule: string | null } {
  return { positionIds: [], visibilityRule: null };
}

function blockId(board: number, n: number): string {
  return `5e${board}00000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function layoutId(board: number): string {
  return `5e${board}10000-0000-4000-8000-000000000001`;
}

function viewId(board: number): string {
  return `5e${board}20000-0000-4000-8000-000000000001`;
}

function block(
  id: string,
  type: BlockDefinition["type"],
  name: string,
  config: BlockDefinition["config"],
): BlockDefinition {
  return { id, type, name, config, visibilityExpression: null, action: null, access: openAccess() };
}

function stat(id: string, label: string, tableId: string, key: string): BlockDefinition {
  return block(id, "stat", label, { tableId, aggregationDefinitionId: `count-${key}`, label });
}

function recordList(
  id: string,
  name: string,
  tableId: string,
  savedView: string | null,
  pageSize: number,
): BlockDefinition {
  return block(id, "record-list", name, {
    tableId,
    pageSize,
    ...(savedView ? { viewId: savedView } : {}),
  });
}

function item(blockIdValue: string, x: number, y: number, width: number, height: number) {
  return { blockId: blockIdValue, x, y, width, height, hidden: false } satisfies LayoutItem;
}

export interface BoardRecipe {
  readonly id: BoardId;
  readonly number: number;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly sources: readonly (readonly [string, string])[];
  readonly blocks: readonly BlockDefinition[];
  readonly items: readonly LayoutItem[];
}

export interface VersionMeta {
  readonly version: number;
  readonly lifecycle: "draft" | "published" | "archived";
  readonly changeSummary: string | null;
  readonly createdAgoMinutes: number;
  readonly publishedAgoMinutes: number | null;
  readonly createdBy: string;
}

/** Builds a bundle (definition + layout) from a recipe, stamping version metadata. */
export function buildBundle(recipe: BoardRecipe, meta: VersionMeta): BoardBundle {
  const createdAt = minutesAgo(meta.createdAgoMinutes);
  const publishedAt =
    meta.publishedAgoMinutes === null ? null : minutesAgo(meta.publishedAgoMinutes);
  const publishedBy = publishedAt ? meta.createdBy : null;
  const definition: BoardDefinition = {
    id: recipe.id,
    tenantId: DEMO_TENANT_ID,
    version: meta.version,
    lifecycle: meta.lifecycle,
    changeSummary: meta.changeSummary,
    createdAt,
    createdBy: meta.createdBy,
    createdPositionId: DEMO_POSITIONS.incidentCommander,
    publishedAt,
    publishedBy,
    key: recipe.key,
    name: recipe.name,
    description: recipe.description,
    dataSources: recipe.sources.map(([alias, tableId]) => ({
      alias,
      tableId,
      filterExpression: null,
    })),
    views: [
      {
        id: viewId(recipe.number),
        viewId: viewId(recipe.number),
        name: "Board",
        access: openAccess(),
      },
    ],
    blocks: [...recipe.blocks],
    layoutId: layoutId(recipe.number),
    access: openAccess(),
  };
  const layout: LayoutDefinition = {
    id: layoutId(recipe.number),
    tenantId: DEMO_TENANT_ID,
    version: meta.version,
    lifecycle: meta.lifecycle,
    changeSummary: meta.changeSummary,
    createdAt,
    createdBy: meta.createdBy,
    createdPositionId: DEMO_POSITIONS.incidentCommander,
    publishedAt,
    publishedBy,
    name: `${recipe.name} layout`,
    boardId: recipe.id,
    positionId: null,
    columns: 12,
    layouts: [
      { breakpoint: "desktop", items: [...recipe.items] },
      {
        breakpoint: "phone",
        items: stackedForPhone(recipe.items),
      },
    ],
  };
  return { definition, layout };
}

function stackedForPhone(items: readonly LayoutItem[]): LayoutItem[] {
  let y = 0;
  return [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((source) => {
      const placed = { ...source, x: 0, y, width: 12 };
      y += source.height;
      return placed;
    });
}

const NOTES =
  "Operational period 4 priorities: (1) complete Harlow Flats evacuation, (2) hold the Eastbank levee, (3) keep shelters under 95% capacity. Fictional demo notes.";

const COMMAND = (n: number): string => blockId(1, n);

const commandStats = [
  stat(COMMAND(1), "Resource requests", DEMO_TABLES.resourceRequests, "requests"),
  stat(COMMAND(2), "Shelters", DEMO_TABLES.shelters, "shelters"),
  stat(COMMAND(3), "Road closures", DEMO_TABLES.roadClosures, "closures"),
  stat(COMMAND(4), "Significant events", DEMO_TABLES.significantEvents, "events"),
];

const commandSources = [
  ["resource_requests", DEMO_TABLES.resourceRequests],
  ["shelters", DEMO_TABLES.shelters],
  ["road_closures", DEMO_TABLES.roadClosures],
  ["significant_events", DEMO_TABLES.significantEvents],
] as const;

const commandBase = {
  id: DEMO_BOARDS.commandOverview,
  number: 1,
  key: "command_overview",
  name: "Command overview",
  description: "Incident Commander summary of requests, shelters, closures and key events.",
  sources: commandSources,
} as const;

const commandEvents = recordList(
  COMMAND(6),
  "Recent significant events",
  DEMO_TABLES.significantEvents,
  null,
  8,
);
const commandNotes = block(COMMAND(7), "rich-text", "Commander's notes", {
  contentDocument: NOTES,
});
const statItems = [
  item(COMMAND(1), 0, 0, 3, 2),
  item(COMMAND(2), 3, 0, 3, 2),
  item(COMMAND(3), 6, 0, 3, 2),
  item(COMMAND(4), 9, 0, 3, 2),
];

/** v1: first cut without the notes block. */
export const commandOverviewV1: BoardRecipe = {
  ...commandBase,
  blocks: [
    ...commandStats,
    recordList(
      COMMAND(5),
      "Critical resource requests",
      DEMO_TABLES.resourceRequests,
      "critical-open",
      10,
    ),
    commandEvents,
  ],
  items: [...statItems, item(COMMAND(5), 0, 2, 12, 5), item(COMMAND(6), 0, 7, 12, 5)],
};

/** v2 (published): adds the commander's notes beside the critical list. */
export const commandOverviewV2: BoardRecipe = {
  ...commandBase,
  blocks: [...commandOverviewV1.blocks, commandNotes],
  items: [
    ...statItems,
    item(COMMAND(5), 0, 2, 8, 6),
    item(COMMAND(7), 8, 2, 4, 6),
    item(COMMAND(6), 0, 8, 12, 5),
  ],
};

/** v3 (draft): critical list widened to Critical + High, shorter page, and a road-closures list. */
export const commandOverviewV3: BoardRecipe = {
  ...commandBase,
  blocks: [
    ...commandStats,
    recordList(
      COMMAND(5),
      "Critical and high priority requests",
      DEMO_TABLES.resourceRequests,
      "critical-high-open",
      8,
    ),
    commandEvents,
    commandNotes,
    recordList(COMMAND(8), "Active road closures", DEMO_TABLES.roadClosures, null, 6),
  ],
  items: [
    ...statItems,
    item(COMMAND(5), 0, 2, 8, 6),
    item(COMMAND(7), 8, 2, 4, 6),
    item(COMMAND(6), 0, 8, 7, 5),
    item(COMMAND(8), 7, 8, 5, 5),
  ],
};

const SHELTER = (n: number): string => blockId(2, n);

export const shelterStatusV1: BoardRecipe = {
  id: DEMO_BOARDS.shelterStatus,
  number: 2,
  key: "shelter_status",
  name: "Shelter status",
  description: "Occupancy and availability across all open and standby shelters.",
  sources: [["shelters", DEMO_TABLES.shelters]],
  blocks: [
    stat(SHELTER(1), "Shelters tracked", DEMO_TABLES.shelters, "shelters"),
    block(SHELTER(2), "rich-text", "Capacity guidance", {
      contentDocument:
        "Redirect arrivals once a shelter passes 90% occupancy. Standby shelters open on the Shelter Manager's call. Fictional demo guidance.",
    }),
    recordList(SHELTER(3), "Shelter occupancy", DEMO_TABLES.shelters, "active-shelters", 12),
  ],
  items: [
    item(SHELTER(1), 0, 0, 4, 2),
    item(SHELTER(2), 4, 0, 8, 2),
    item(SHELTER(3), 0, 2, 12, 7),
  ],
};

const LOGISTICS = (n: number): string => blockId(3, n);

export const logisticsV1: BoardRecipe = {
  id: DEMO_BOARDS.logistics,
  number: 3,
  key: "logistics",
  name: "Logistics",
  description: "Resource requests grouped by fulfilment status.",
  sources: [["resource_requests", DEMO_TABLES.resourceRequests]],
  blocks: [
    stat(LOGISTICS(1), "All requests", DEMO_TABLES.resourceRequests, "requests"),
    recordList(LOGISTICS(2), "New requests", DEMO_TABLES.resourceRequests, "status-new", 10),
    recordList(LOGISTICS(3), "Approved", DEMO_TABLES.resourceRequests, "status-approved", 10),
    recordList(LOGISTICS(4), "En route", DEMO_TABLES.resourceRequests, "status-en-route", 10),
    recordList(LOGISTICS(5), "Fulfilled", DEMO_TABLES.resourceRequests, "status-fulfilled", 10),
  ],
  items: [
    item(LOGISTICS(1), 0, 0, 12, 2),
    item(LOGISTICS(2), 0, 2, 6, 5),
    item(LOGISTICS(3), 6, 2, 6, 5),
    item(LOGISTICS(4), 0, 7, 6, 5),
    item(LOGISTICS(5), 6, 7, 6, 5),
  ],
};

const author = DEMO_USERS.priyaShah;
const owner = DEMO_ACTOR.userId;

/** Initial version history per board, oldest first. */
export function createInitialVersions(): ReadonlyMap<string, readonly BoardBundle[]> {
  return new Map<string, readonly BoardBundle[]>([
    [
      DEMO_BOARDS.commandOverview,
      [
        buildBundle(commandOverviewV1, {
          version: 1,
          lifecycle: "archived",
          changeSummary: "Initial command overview.",
          createdAgoMinutes: 4_300,
          publishedAgoMinutes: 4_290,
          createdBy: author,
        }),
        buildBundle(commandOverviewV2, {
          version: 2,
          lifecycle: "published",
          changeSummary: "Added commander's notes beside the critical request list.",
          createdAgoMinutes: 1_500,
          publishedAgoMinutes: 1_480,
          createdBy: owner,
        }),
        buildBundle(commandOverviewV3, {
          version: 3,
          lifecycle: "draft",
          changeSummary: null,
          createdAgoMinutes: 35,
          publishedAgoMinutes: null,
          createdBy: owner,
        }),
      ],
    ],
    [
      DEMO_BOARDS.shelterStatus,
      [
        buildBundle(shelterStatusV1, {
          version: 1,
          lifecycle: "published",
          changeSummary: "Initial shelter status board.",
          createdAgoMinutes: 2_900,
          publishedAgoMinutes: 2_880,
          createdBy: DEMO_USERS.samRivera,
        }),
      ],
    ],
    [
      DEMO_BOARDS.logistics,
      [
        buildBundle(logisticsV1, {
          version: 1,
          lifecycle: "published",
          changeSummary: "Initial logistics board.",
          createdAgoMinutes: 2_700,
          publishedAgoMinutes: 2_690,
          createdBy: DEMO_USERS.jordanLee,
        }),
      ],
    ],
  ]);
}
