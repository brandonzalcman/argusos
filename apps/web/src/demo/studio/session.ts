import {
  type Incident,
  type Position,
  type SelectIncidentInput,
  type SelectPositionInput,
  type SessionSnapshot,
  type StudioPermissions,
  sessionSnapshotSchema,
  type Tenant,
  type User,
} from "@argus/schema";
import type { SessionPort } from "../../services/studio.js";
import { demoIncidentsSource } from "../incidents.js";
import {
  DEMO_INCIDENTS,
  DEMO_POSITIONS,
  DEMO_SCOPE,
  DEMO_TENANT_ID,
  DEMO_USERS,
  demoDelay,
  minutesAgo,
} from "../scenario.js";

/*
 * Fictional demo session. Every name, address and organisation here is invented; nothing is sent
 * to a server and state lives only in this browser tab.
 */

const MONTH = 30 * 24 * 60;

export const DEMO_STUDIO_TENANT: Tenant = {
  id: DEMO_TENANT_ID,
  slug: "northbank_county",
  name: "Northbank County Emergency Management",
  status: "active",
  createdAt: minutesAgo(12 * MONTH),
  updatedAt: minutesAgo(MONTH),
};

export const DEMO_STUDIO_USER: User = {
  id: DEMO_USERS.alexMorgan,
  tenantId: DEMO_TENANT_ID,
  displayName: "Alex Morgan",
  email: "alex.morgan@example.org",
  status: "active",
  createdAt: minutesAgo(12 * MONTH),
  updatedAt: minutesAgo(MONTH),
};

function position(
  id: string,
  key: string,
  name: string,
  description: string,
  homepageBoardId: string | null,
): Position {
  return { id, tenantId: DEMO_TENANT_ID, key, name, description, homepageBoardId, isSystem: false };
}

export const DEMO_STUDIO_POSITIONS: readonly Position[] = [
  position(
    DEMO_POSITIONS.incidentCommander,
    "incident_commander",
    "Incident Commander",
    "Overall incident command (fictional).",
    "5e000000-0000-4000-8000-000000000001",
  ),
  position(
    DEMO_POSITIONS.operationsChief,
    "operations_chief",
    "Operations Section Chief",
    "Tactical operations (fictional).",
    null,
  ),
  position(
    DEMO_POSITIONS.planningChief,
    "planning_chief",
    "Planning Section Chief",
    "Situation and resource status (fictional).",
    null,
  ),
  position(
    DEMO_POSITIONS.logisticsChief,
    "logistics_chief",
    "Logistics Section Chief",
    "Supply and facilities (fictional).",
    "5e000000-0000-4000-8000-000000000003",
  ),
  position(
    DEMO_POSITIONS.publicInformation,
    "public_information_officer",
    "Public Information Officer",
    "Public messaging (fictional).",
    null,
  ),
  position(
    DEMO_POSITIONS.shelterManager,
    "shelter_manager",
    "Shelter Manager",
    "Runs shelter intake (fictional).",
    "5e000000-0000-4000-8000-000000000002",
  ),
];

const ALL: StudioPermissions = {
  viewStudio: true,
  editDefinitions: true,
  publishDefinitions: true,
  editCode: true,
};

/** Studio permissions per demo position; the Shelter Manager cannot open dev mode at all. */
export const DEMO_STUDIO_PERMISSIONS: Readonly<Record<string, StudioPermissions>> = {
  [DEMO_POSITIONS.incidentCommander]: ALL,
  [DEMO_POSITIONS.operationsChief]: { ...ALL, editCode: false },
  [DEMO_POSITIONS.planningChief]: { ...ALL, publishDefinitions: false, editCode: false },
  [DEMO_POSITIONS.logisticsChief]: { ...ALL, publishDefinitions: false, editCode: false },
  [DEMO_POSITIONS.publicInformation]: { ...ALL, editCode: false },
  [DEMO_POSITIONS.shelterManager]: {
    viewStudio: false,
    editDefinitions: false,
    publishDefinitions: false,
    editCode: false,
  },
};

const NO_PERMISSIONS: StudioPermissions = {
  viewStudio: false,
  editDefinitions: false,
  publishDefinitions: false,
  editCode: false,
};

/** Operational period shown for the flood incident in the studio session. */
const FLOOD_OPERATIONAL_PERIOD = "OP 4 · 18 Nov 06:00–18:00";

/**
 * In-memory SessionPort for demo mode: Alex Morgan (Incident Commander) at Northbank County,
 * acting in the Harlow River flood. `selectPosition` and `selectIncident` switch the snapshot.
 */
export function createDemoSessionPort(latencyMs = 150): SessionPort {
  let positionId: string = DEMO_POSITIONS.incidentCommander;
  let incidentId: string | null = DEMO_INCIDENTS.harlowFlood;
  let incidents: readonly Incident[] | null = null;

  const loadIncidents = async (): Promise<readonly Incident[]> => {
    incidents ??= (await demoIncidentsSource.list(DEMO_SCOPE)).map((incident) =>
      incident.id === DEMO_INCIDENTS.harlowFlood
        ? { ...incident, operationalPeriod: FLOOD_OPERATIONAL_PERIOD }
        : incident,
    );
    return incidents;
  };

  const snapshot = async (): Promise<SessionSnapshot> => {
    const current = DEMO_STUDIO_POSITIONS.find((candidate) => candidate.id === positionId);
    if (!current) throw new Error(`position-not-found: ${positionId}`);
    const activeIncident = incidentId
      ? ((await loadIncidents()).find((incident) => incident.id === incidentId) ?? null)
      : null;
    return {
      user: DEMO_STUDIO_USER,
      tenant: DEMO_STUDIO_TENANT,
      position: current,
      availablePositions: [...DEMO_STUDIO_POSITIONS],
      activeIncident,
      studio: DEMO_STUDIO_PERMISSIONS[current.id] ?? NO_PERMISSIONS,
    };
  };

  return {
    get: async () => demoDelay(await snapshot(), latencyMs),
    selectPosition: async (input: SelectPositionInput) => {
      if (!DEMO_STUDIO_POSITIONS.some((candidate) => candidate.id === input.positionId)) {
        throw new Error("forbidden: position is not assigned to this user");
      }
      positionId = input.positionId;
      return demoDelay(await snapshot(), latencyMs);
    },
    selectIncident: async (input: SelectIncidentInput) => {
      if (
        input.incidentId !== null &&
        !(await loadIncidents()).some((incident) => incident.id === input.incidentId)
      ) {
        throw new Error("forbidden: incident is not accessible");
      }
      incidentId = input.incidentId;
      return demoDelay(await snapshot(), latencyMs);
    },
  };
}

/** Validates a snapshot against the shared contract (used by tests and as a dev assertion). */
export function assertDemoSessionSnapshot(value: unknown): SessionSnapshot {
  return sessionSnapshotSchema.parse(value);
}
