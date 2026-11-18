import type { AuthorizationPreviewResult } from "../services/authorization-preview.js";
import type { CommandDescriptor, CommandProvider } from "../services/command-palette.js";
import type { ElectricSyncPort, ElectricSyncSnapshot } from "../services/electric-sync.js";
import type { AppServices } from "../services/index.js";
import type { PresenceUpdate } from "../services/presence.js";
import {
  DEMO_BOARDS,
  DEMO_INCIDENTS,
  DEMO_POSITIONS,
  DEMO_TABLES,
  DEMO_USERS,
  minutesAgo,
} from "./scenario.js";

type ChangeListener = (change: { walPosition: string; committedAt: string }) => void;

/** Subscribers keyed by Electric tableId, so demo mutations can refresh live queries. */
const subscribers = new Map<string, Set<ChangeListener>>();
let walCounter = 0;

/** Signals that rows of `tableId` changed; live queries subscribed to it refetch. */
export function notifyDemoChange(tableId: string): void {
  walCounter += 1;
  const change = { walPosition: `0/DEMO${walCounter.toString(16)}`, committedAt: minutesAgo(0) };
  for (const listener of subscribers.get(tableId) ?? []) listener(change);
}

function liveSnapshot(): ElectricSyncSnapshot {
  return {
    state: "live",
    lastVisibleCommitAt: minutesAgo(0),
    detail: "Demo mode: in-memory fictional data, no Electric connection.",
  };
}

function createDemoElectricSync(): ElectricSyncPort {
  return {
    subscribe: async (request) => {
      const listener: ChangeListener = (change) => request.onChange(change);
      const set = subscribers.get(request.tableId) ?? new Set<ChangeListener>();
      set.add(listener);
      subscribers.set(request.tableId, set);
      request.onSnapshot(liveSnapshot());
      return () => {
        set.delete(listener);
      };
    },
    refresh: () => Promise.resolve(),
    getSnapshot: () => liveSnapshot(),
  };
}

function entry(
  id: string,
  title: string,
  kind: CommandDescriptor["kind"],
  targetId: string,
  requiredPermission: string,
): CommandDescriptor {
  return { id, title, kind, targetId, requiredPermission };
}

const paletteEntries: readonly CommandDescriptor[] = [
  entry("inc-flood", "Harlow River Flood", "incident", DEMO_INCIDENTS.harlowFlood, "incident:read"),
  entry("inc-storm", "Coastal Storm Watch", "incident", DEMO_INCIDENTS.stormWatch, "incident:read"),
  entry(
    "inc-spill",
    "Westgate Chemical Spill",
    "incident",
    DEMO_INCIDENTS.chemicalSpill,
    "incident:read",
  ),
  entry(
    "inc-ember",
    "Operation Ember (wildfire exercise)",
    "incident",
    DEMO_INCIDENTS.wildfireExercise,
    "incident:read",
  ),
  entry(
    "inc-winter",
    "Winter Readiness Exercise",
    "incident",
    DEMO_INCIDENTS.winterExercise,
    "incident:read",
  ),
  entry(
    "pos-ic",
    "Incident Commander",
    "position",
    DEMO_POSITIONS.incidentCommander,
    "position:read",
  ),
  entry(
    "pos-ops",
    "Operations Section Chief",
    "position",
    DEMO_POSITIONS.operationsChief,
    "position:read",
  ),
  entry(
    "pos-plan",
    "Planning Section Chief",
    "position",
    DEMO_POSITIONS.planningChief,
    "position:read",
  ),
  entry(
    "pos-log",
    "Logistics Section Chief",
    "position",
    DEMO_POSITIONS.logisticsChief,
    "position:read",
  ),
  entry(
    "pos-pio",
    "Public Information Officer",
    "position",
    DEMO_POSITIONS.publicInformation,
    "position:read",
  ),
  entry(
    "pos-shelter",
    "Shelter Manager",
    "position",
    DEMO_POSITIONS.shelterManager,
    "position:read",
  ),
  entry("tbl-requests", "Resource requests", "record", DEMO_TABLES.resourceRequests, "table:read"),
  entry("tbl-shelters", "Shelters", "record", DEMO_TABLES.shelters, "table:read"),
  entry("tbl-roads", "Road closures", "record", DEMO_TABLES.roadClosures, "table:read"),
  entry("tbl-events", "Significant events", "record", DEMO_TABLES.significantEvents, "table:read"),
];

function preview(
  version: number,
  decision: AuthorizationPreviewResult["decisions"][number],
): AuthorizationPreviewResult {
  return {
    decisions: [decision],
    hiddenBlockIds: [],
    hiddenFieldIds: ["contact_phone"],
    readOnlyFieldIds: ["created_by"],
    evaluatedDefinitionVersion: version,
  };
}

function presenceUpdates(): readonly PresenceUpdate[] {
  return [
    {
      identity: {
        userId: DEMO_USERS.priyaShah,
        positionId: DEMO_POSITIONS.operationsChief,
        displayName: "Priya Shah",
        positionLabel: "Operations Section Chief",
      },
      location: { boardId: DEMO_BOARDS.commandOverview },
      lastSeenAt: minutesAgo(0),
    },
    {
      identity: {
        userId: DEMO_USERS.jordanLee,
        positionId: DEMO_POSITIONS.logisticsChief,
        displayName: "Jordan Lee",
        positionLabel: "Logistics Section Chief",
      },
      location: { boardId: DEMO_BOARDS.logistics },
      lastSeenAt: minutesAgo(0),
    },
    {
      identity: {
        userId: DEMO_USERS.samRivera,
        positionId: DEMO_POSITIONS.shelterManager,
        displayName: "Sam Rivera",
        positionLabel: "Shelter Manager",
      },
      location: { boardId: DEMO_BOARDS.shelterStatus },
      lastSeenAt: minutesAgo(1),
    },
  ];
}

/**
 * Creates fully in-memory service ports for demo mode: always-live sync, a connected gateway,
 * a few fictional users online, local palette search and no-op telemetry.
 */
export function createDemoServices(): AppServices {
  const providers = new Set<CommandProvider>();
  return {
    electricSync: createDemoElectricSync(),
    offlineMutations: {
      enqueue: () => Promise.resolve(),
      list: () => Promise.resolve([]),
      listConflicts: () => Promise.resolve([]),
      resolveConflict: () => Promise.resolve(),
      replay: () => Promise.resolve(),
    },
    realtime: {
      connect: (request) => {
        request.onSnapshot({
          webSocket: "live",
          natsGateway: "connected",
          lastEventAt: minutesAgo(0),
          reconnectAttempt: 0,
        });
        return () => undefined;
      },
      subscribeAlerts: () => () => undefined,
      getSnapshot: () => ({
        webSocket: "live",
        natsGateway: "connected",
        lastEventAt: minutesAgo(0),
        reconnectAttempt: 0,
      }),
    },
    presence: {
      publish: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      subscribe: (_scope, listener) => {
        listener(presenceUpdates());
        const timer = setInterval(() => listener(presenceUpdates()), 20_000);
        return () => clearInterval(timer);
      },
    },
    commandPalette: {
      registerProvider: (provider) => {
        providers.add(provider);
        return () => {
          providers.delete(provider);
        };
      },
      search: async (request) => {
        const query = request.query.trim().toLowerCase();
        const local = paletteEntries.filter(
          (candidate) => query === "" || candidate.title.toLowerCase().includes(query),
        );
        const extra = await Promise.all(
          [...providers].map((provider) => provider.search(request).catch(() => [])),
        );
        return [...local, ...extra.flat()].slice(0, request.limit);
      },
    },
    authorizationPreview: {
      previewBoard: (request) =>
        Promise.resolve(
          preview(request.definitionVersion, {
            effect: "allow",
            policyId: "demo-policy-command-staff",
            reason: "Demo: this position may view the board.",
          }),
        ),
      previewRecordAction: (request) =>
        Promise.resolve(
          request.action === "delete"
            ? preview(request.definitionVersion, {
                effect: "deny",
                policyId: "demo-policy-record-delete",
                reason: "Demo: only the Incident Commander may delete records.",
              })
            : preview(request.definitionVersion, {
                effect: "allow",
                policyId: "demo-policy-command-staff",
                reason: `Demo: ${request.action} is permitted for this position.`,
              }),
        ),
    },
    instrumentation: {
      startSpan: () => ({ end: () => undefined }),
      reportCommitToVisible: () => undefined,
      reportInteraction: () => undefined,
    },
  };
}
