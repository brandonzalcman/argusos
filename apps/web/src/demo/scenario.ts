import type { ActorContext, AppScope } from "../services/contracts.js";

/**
 * Shared fictional scenario for demo mode. Every demo adapter references these ids so incidents,
 * tables, boards, alerts, workflows and admin screens tell one consistent story.
 *
 * Scenario: "Northbank County Emergency Management" is responding to the Harlow River flood
 * (live, active, level 3). A wildfire exercise and older incidents provide variety.
 * All names, places, people and numbers are invented.
 */
export const DEMO_TENANT_ID = "0b7c1d2e-0000-4000-8000-000000000001";

export const DEMO_INCIDENTS = {
  harlowFlood: "1a000000-0000-4000-8000-000000000001", // live, active, level 3
  stormWatch: "1a000000-0000-4000-8000-000000000002", // live, monitoring, level 1
  chemicalSpill: "1a000000-0000-4000-8000-000000000003", // live, closed
  wildfireExercise: "1a000000-0000-4000-8000-000000000004", // exercise, active
  winterExercise: "1a000000-0000-4000-8000-000000000005", // exercise, planned
} as const;

export const DEMO_POSITIONS = {
  incidentCommander: "2b000000-0000-4000-8000-000000000001",
  operationsChief: "2b000000-0000-4000-8000-000000000002",
  planningChief: "2b000000-0000-4000-8000-000000000003",
  logisticsChief: "2b000000-0000-4000-8000-000000000004",
  publicInformation: "2b000000-0000-4000-8000-000000000005",
  shelterManager: "2b000000-0000-4000-8000-000000000006",
} as const;

export const DEMO_USERS = {
  /** The signed-in demo user (Incident Commander). */
  alexMorgan: "3c000000-0000-4000-8000-000000000001",
  priyaShah: "3c000000-0000-4000-8000-000000000002",
  jordanLee: "3c000000-0000-4000-8000-000000000003",
  samRivera: "3c000000-0000-4000-8000-000000000004",
  caseyNguyen: "3c000000-0000-4000-8000-000000000005",
} as const;

export const DEMO_USER_NAMES: Readonly<Record<string, string>> = {
  [DEMO_USERS.alexMorgan]: "Alex Morgan",
  [DEMO_USERS.priyaShah]: "Priya Shah",
  [DEMO_USERS.jordanLee]: "Jordan Lee",
  [DEMO_USERS.samRivera]: "Sam Rivera",
  [DEMO_USERS.caseyNguyen]: "Casey Nguyen",
};

/** Physical user tables shown in the Tables feature and used as board data sources. */
export const DEMO_TABLES = {
  resourceRequests: "4d000000-0000-4000-8000-000000000001",
  shelters: "4d000000-0000-4000-8000-000000000002",
  roadClosures: "4d000000-0000-4000-8000-000000000003",
  significantEvents: "4d000000-0000-4000-8000-000000000004",
} as const;

export const DEMO_BOARDS = {
  commandOverview: "5e000000-0000-4000-8000-000000000001",
  shelterStatus: "5e000000-0000-4000-8000-000000000002",
  logistics: "5e000000-0000-4000-8000-000000000003",
} as const;

export const DEMO_WORKFLOWS = {
  escalateCriticalRequest: "6f000000-0000-4000-8000-000000000001",
  shelterCapacityAlert: "6f000000-0000-4000-8000-000000000002",
  dailySituationReport: "6f000000-0000-4000-8000-000000000003",
} as const;

export const DEMO_MAPS = {
  commonOperatingPicture: "7a000000-0000-4000-8000-000000000001",
} as const;

/** Geographic centre of the fictional Harlow River area (used by maps). */
export const DEMO_MAP_CENTER = { longitude: -122.675, latitude: 45.52 } as const;

export const DEMO_SCOPE: AppScope = {
  tenantId: DEMO_TENANT_ID,
  incidentId: DEMO_INCIDENTS.harlowFlood,
};

export const DEMO_ACTOR: ActorContext = {
  userId: DEMO_USERS.alexMorgan,
  positionId: DEMO_POSITIONS.incidentCommander,
  sessionId: "8b000000-0000-4000-8000-000000000001",
};

/** Timestamps are relative to page load so the demo always looks current. */
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Simulated network latency so loading states are briefly visible. */
export function demoDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let idCounter = 0;
/** v4-format UUID for records created during a demo session. */
export function demoId(): string {
  idCounter += 1;
  const suffix = (Date.now().toString(16) + idCounter.toString(16).padStart(4, "0")).slice(-12);
  return `9c000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}
