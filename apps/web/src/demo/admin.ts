import type {
  LayoutDefinition,
  LayoutItem,
  MenuDefinition,
  MenuItem,
  Position,
  ThemeDefinition,
  ThemeTokens,
} from "@argus/schema";
import {
  type AdminServicePort,
  DefinitionConflictError,
  type SaveDraftRequest,
  type UserPreferences,
} from "../features/admin/admin-service.js";
import {
  DEMO_BOARDS,
  DEMO_POSITIONS,
  DEMO_TENANT_ID,
  DEMO_USERS,
  DEMO_WORKFLOWS,
  demoDelay,
  minutesAgo,
} from "./scenario.js";

const CREATED_AT = minutesAgo(60 * 24 * 90);
const PUBLISHED_AT = minutesAgo(60 * 24 * 30);
const ADMIN_ID = DEMO_USERS.priyaShah;
const ADMIN_POSITION = DEMO_POSITIONS.incidentCommander;
/** Menu "url" items must be absolute URLs; this host is fictional. */
const APP_ORIGIN = "https://argus.northbank.example";

const POSITIONS: readonly Position[] = [
  {
    id: DEMO_POSITIONS.incidentCommander,
    tenantId: DEMO_TENANT_ID,
    key: "incident_commander",
    name: "Incident Commander",
    description: "Overall responsibility for incident objectives and resources.",
    homepageBoardId: DEMO_BOARDS.commandOverview,
    isSystem: true,
  },
  {
    id: DEMO_POSITIONS.operationsChief,
    tenantId: DEMO_TENANT_ID,
    key: "operations_section_chief",
    name: "Operations Section Chief",
    description: "Directs tactical operations to meet the incident objectives.",
    homepageBoardId: DEMO_BOARDS.commandOverview,
    isSystem: true,
  },
  {
    id: DEMO_POSITIONS.planningChief,
    tenantId: DEMO_TENANT_ID,
    key: "planning_section_chief",
    name: "Planning Section Chief",
    description: "Collects situation information and maintains the incident action plan.",
    homepageBoardId: DEMO_BOARDS.commandOverview,
    isSystem: true,
  },
  {
    id: DEMO_POSITIONS.logisticsChief,
    tenantId: DEMO_TENANT_ID,
    key: "logistics_section_chief",
    name: "Logistics Section Chief",
    description: "Provides resources, facilities, services and supplies.",
    homepageBoardId: DEMO_BOARDS.logistics,
    isSystem: true,
  },
  {
    id: DEMO_POSITIONS.publicInformation,
    tenantId: DEMO_TENANT_ID,
    key: "public_information_officer",
    name: "Public Information Officer",
    description: "Prepares and releases public messaging.",
    homepageBoardId: null,
    isSystem: true,
  },
  {
    id: DEMO_POSITIONS.shelterManager,
    tenantId: DEMO_TENANT_ID,
    key: "shelter_manager",
    name: "Shelter Manager",
    description: "Runs shelter intake, capacity and welfare reporting.",
    homepageBoardId: DEMO_BOARDS.shelterStatus,
    isSystem: false,
  },
];

const lightTokens = {
  colors: {
    surface: "#ffffff",
    "surface-muted": "#eef2f6",
    text: "#14202b",
    "text-muted": "#4a5866",
    accent: "#0b5cab",
    border: "#6b7a89",
    danger: "#b42318",
    success: "#18794e",
  },
  radii: { control: "4px", panel: "8px" },
  spacing: { control: "0.5rem", panel: "1rem" },
  typography: {
    body: "Inter, system-ui, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  density: "comfortable",
} satisfies ThemeTokens;

const darkTokens = {
  ...lightTokens,
  colors: {
    surface: "#0f1720",
    "surface-muted": "#1a2531",
    text: "#e8eef4",
    "text-muted": "#a9b6c3",
    accent: "#6cb2ff",
    border: "#7c8b9a",
    danger: "#ff8a7a",
    success: "#56d19a",
  },
} satisfies ThemeTokens;

const highContrastTokens = {
  ...lightTokens,
  colors: {
    surface: "#000000",
    "surface-muted": "#111111",
    text: "#ffffff",
    "text-muted": "#e0e0e0",
    accent: "#ffd400",
    border: "#ffffff",
    danger: "#ff6b6b",
    success: "#5dff9c",
  },
} satisfies ThemeTokens;

const THEME: ThemeDefinition = {
  id: "a1000000-0000-4000-8000-000000000001",
  tenantId: DEMO_TENANT_ID,
  version: 3,
  lifecycle: "published",
  changeSummary: "Northbank County EM branding and high-contrast mode",
  createdAt: CREATED_AT,
  createdBy: ADMIN_ID,
  createdPositionId: ADMIN_POSITION,
  publishedAt: PUBLISHED_AT,
  publishedBy: ADMIN_ID,
  name: "Northbank County Emergency Management",
  activeMode: "light",
  modes: { light: lightTokens, dark: darkTokens, "high-contrast": highContrastTokens },
  terminology: {
    incident: "Incident",
    position: "Position",
    board: "Board",
    record: "Record",
  },
  logoAttachmentId: null,
  rightToLeft: false,
};

function menuItem(
  id: number,
  label: string,
  patch: Partial<MenuItem> & Pick<MenuItem, "type">,
): MenuItem {
  return {
    id: `a2000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    label,
    targetId: null,
    url: null,
    icon: null,
    positionIds: [],
    visibilityExpression: null,
    children: [],
    ...patch,
  };
}

const route = (path: string): string => `${APP_ORIGIN}${path}`;

const MENU: MenuDefinition = {
  id: "a2000000-0000-4000-8000-0000000000f1",
  tenantId: DEMO_TENANT_ID,
  version: 2,
  lifecycle: "published",
  changeSummary: "Group navigation by function",
  createdAt: CREATED_AT,
  createdBy: ADMIN_ID,
  createdPositionId: ADMIN_POSITION,
  publishedAt: PUBLISHED_AT,
  publishedBy: ADMIN_ID,
  name: "Northbank main navigation",
  items: [
    menuItem(1, "Command", {
      type: "section",
      children: [
        menuItem(2, "Home", { type: "url", url: route("/"), icon: "home" }),
        menuItem(3, "Incidents", { type: "url", url: route("/incidents"), icon: "siren" }),
        menuItem(4, "Command overview", {
          type: "board",
          targetId: DEMO_BOARDS.commandOverview,
          icon: "layout-dashboard",
          positionIds: [
            DEMO_POSITIONS.incidentCommander,
            DEMO_POSITIONS.operationsChief,
            DEMO_POSITIONS.planningChief,
          ],
        }),
        menuItem(5, "Common operating picture", {
          type: "url",
          url: route("/maps"),
          icon: "map",
        }),
      ],
    }),
    menuItem(10, "Operations", {
      type: "section",
      children: [
        menuItem(11, "Logistics board", {
          type: "board",
          targetId: DEMO_BOARDS.logistics,
          icon: "truck",
          positionIds: [DEMO_POSITIONS.logisticsChief, DEMO_POSITIONS.incidentCommander],
        }),
        menuItem(12, "Shelter status", {
          type: "board",
          targetId: DEMO_BOARDS.shelterStatus,
          icon: "home",
          positionIds: [
            DEMO_POSITIONS.shelterManager,
            DEMO_POSITIONS.incidentCommander,
            DEMO_POSITIONS.publicInformation,
          ],
        }),
        menuItem(13, "Boards", { type: "url", url: route("/boards"), icon: "layout-grid" }),
        menuItem(14, "Tables", {
          type: "url",
          url: route("/tables"),
          icon: "table",
          positionIds: [
            DEMO_POSITIONS.incidentCommander,
            DEMO_POSITIONS.planningChief,
            DEMO_POSITIONS.logisticsChief,
          ],
        }),
      ],
    }),
    menuItem(20, "Communications and automation", {
      type: "section",
      children: [
        menuItem(21, "Alerts", { type: "url", url: route("/alerts"), icon: "bell" }),
        menuItem(22, "Workflows", {
          type: "url",
          url: route("/workflows"),
          icon: "workflow",
          positionIds: [DEMO_POSITIONS.incidentCommander, DEMO_POSITIONS.planningChief],
        }),
        menuItem(23, "Escalate critical requests", {
          type: "workflow",
          targetId: DEMO_WORKFLOWS.escalateCriticalRequest,
          icon: "workflow",
          positionIds: [DEMO_POSITIONS.logisticsChief],
        }),
      ],
    }),
  ],
};

function layoutItem(n: number, x: number, y: number, width: number, height: number): LayoutItem {
  return {
    blockId: `a3000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    x,
    y,
    width,
    height,
    hidden: false,
  };
}

function homepage(
  n: number,
  name: string,
  positionId: string,
  boardId: string | null,
  items: readonly LayoutItem[],
  version: number,
): LayoutDefinition {
  let phoneY = 0;
  const phoneItems = items.map((item) => {
    const placed = { ...item, x: 0, y: phoneY, width: 12 };
    phoneY += item.height;
    return placed;
  });
  return {
    id: `a3000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
    tenantId: DEMO_TENANT_ID,
    version,
    lifecycle: "published",
    changeSummary: null,
    createdAt: CREATED_AT,
    createdBy: ADMIN_ID,
    createdPositionId: ADMIN_POSITION,
    publishedAt: PUBLISHED_AT,
    publishedBy: ADMIN_ID,
    name,
    boardId,
    positionId,
    columns: 12,
    layouts: [
      { breakpoint: "desktop", items: [...items] },
      { breakpoint: "phone", items: phoneItems },
    ],
  };
}

const HOMEPAGES: readonly LayoutDefinition[] = [
  homepage(
    1,
    "Incident Commander homepage",
    DEMO_POSITIONS.incidentCommander,
    DEMO_BOARDS.commandOverview,
    [layoutItem(1, 0, 0, 8, 4), layoutItem(2, 8, 0, 4, 4), layoutItem(3, 0, 4, 12, 5)],
    2,
  ),
  homepage(
    2,
    "Operations homepage",
    DEMO_POSITIONS.operationsChief,
    DEMO_BOARDS.commandOverview,
    [layoutItem(4, 0, 0, 6, 4), layoutItem(5, 6, 0, 6, 4)],
    1,
  ),
  homepage(
    3,
    "Planning homepage",
    DEMO_POSITIONS.planningChief,
    DEMO_BOARDS.commandOverview,
    [layoutItem(6, 0, 0, 12, 3), layoutItem(7, 0, 3, 6, 4), layoutItem(8, 6, 3, 6, 4)],
    1,
  ),
  homepage(
    4,
    "Logistics homepage",
    DEMO_POSITIONS.logisticsChief,
    DEMO_BOARDS.logistics,
    [layoutItem(9, 0, 0, 4, 3), layoutItem(10, 4, 0, 8, 3), layoutItem(11, 0, 3, 12, 5)],
    3,
  ),
  homepage(
    5,
    "Public information homepage",
    DEMO_POSITIONS.publicInformation,
    null,
    [layoutItem(12, 0, 0, 6, 4), layoutItem(13, 6, 0, 6, 4)],
    1,
  ),
  homepage(
    6,
    "Shelter Manager homepage",
    DEMO_POSITIONS.shelterManager,
    DEMO_BOARDS.shelterStatus,
    [layoutItem(14, 0, 0, 12, 3), layoutItem(15, 0, 3, 7, 5), layoutItem(16, 7, 3, 5, 5)],
    2,
  ),
];

const PREFERENCES: UserPreferences = {
  version: 1,
  density: "comfortable",
  locale: "en-US",
  rightToLeft: false,
  reducedMotion: "system",
};

/**
 * In-memory admin service for demo mode. Saves honor optimistic versioning: a stale
 * expectedVersion throws DefinitionConflictError carrying the current in-memory value.
 */
export function createDemoAdminService(): AdminServicePort {
  let theme = THEME;
  let menu = MENU;
  let preferences = PREFERENCES;
  const homepages = new Map(HOMEPAGES.map((layout) => [layout.id, layout]));

  return {
    listPositions: () => demoDelay(POSITIONS),
    getTheme: () => demoDelay(theme),
    getMenu: () => demoDelay(menu),
    listHomepages: () => demoDelay([...homepages.values()]),
    getPreferences: () => demoDelay(preferences),

    saveTheme: async (request: SaveDraftRequest<ThemeDefinition>) => {
      if (request.expectedVersion !== theme.version) throw new DefinitionConflictError(theme);
      theme = { ...request.definition, version: theme.version + 1 };
      return demoDelay(theme, 350);
    },
    saveMenu: async (request: SaveDraftRequest<MenuDefinition>) => {
      if (request.expectedVersion !== menu.version) throw new DefinitionConflictError(menu);
      menu = { ...request.definition, version: menu.version + 1 };
      return demoDelay(menu, 350);
    },
    saveHomepage: async (request: SaveDraftRequest<LayoutDefinition>) => {
      const current = homepages.get(request.definition.id);
      if (current && request.expectedVersion !== current.version) {
        throw new DefinitionConflictError(current);
      }
      const saved = { ...request.definition, version: (current?.version ?? 0) + 1 };
      homepages.set(saved.id, saved);
      return demoDelay(saved, 350);
    },
    savePreferences: async (request: SaveDraftRequest<UserPreferences>) => {
      if (request.expectedVersion !== preferences.version) {
        throw new DefinitionConflictError(preferences);
      }
      preferences = { ...request.definition, version: preferences.version + 1 };
      return demoDelay(preferences, 200);
    },
    clearOfflineData: () => demoDelay(undefined, 300),
  };
}
