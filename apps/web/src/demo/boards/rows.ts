import type { RecordEnvelope } from "@argus/schema";
import {
  DEMO_ACTOR,
  DEMO_INCIDENTS,
  DEMO_POSITIONS,
  DEMO_TABLES,
  DEMO_TENANT_ID,
  DEMO_USERS,
  minutesAgo,
} from "../scenario.js";

/** Self-contained fictional row fixtures for board data sources. */

function rowId(table: number, n: number): string {
  return `4e0${table}0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function envelope(
  tableId: string,
  id: string,
  values: Record<string, unknown>,
  ageMinutes: number,
  updatedAgoMinutes = ageMinutes,
): RecordEnvelope {
  return {
    id,
    tenantId: DEMO_TENANT_ID,
    tableId,
    incidentId: DEMO_INCIDENTS.harlowFlood,
    values,
    createdAt: minutesAgo(ageMinutes),
    createdBy: DEMO_USERS.priyaShah,
    createdPositionId: DEMO_POSITIONS.planningChief,
    updatedAt: minutesAgo(updatedAgoMinutes),
    updatedBy: DEMO_ACTOR.userId,
    updatedPositionId: DEMO_POSITIONS.incidentCommander,
    version: 1,
    deletedAt: null,
  };
}

// title, resourceType, quantity, priority, status, age (minutes)
const REQUESTS: readonly (readonly [string, string, number, string, string, number])[] = [
  ["Portable pumps for Mill Street", "Equipment", 6, "Critical", "En route", 40],
  ["Sandbags for Eastbank levee", "Supplies", 4000, "Critical", "Approved", 95],
  ["Boat crews for Harlow Flats evacuation", "Personnel", 3, "Critical", "New", 12],
  ["Generators for Riverside Clinic", "Equipment", 2, "Critical", "New", 25],
  ["Bottled water pallets for shelters", "Supplies", 30, "High", "Approved", 180],
  ["Cots and blankets for Northbank High", "Supplies", 150, "High", "En route", 210],
  ["Medical supply resupply", "Medical", 12, "High", "New", 55],
  ["Traffic barricades for Route 9", "Equipment", 40, "Normal", "Fulfilled", 400],
  ["Interpreter support at shelters", "Personnel", 4, "Normal", "Approved", 150],
  ["Pet supplies for Fairgrounds shelter", "Supplies", 25, "Low", "New", 70],
  ["Portable lighting towers", "Equipment", 5, "Normal", "Fulfilled", 520],
  ["Additional fuel delivery", "Supplies", 3, "High", "Denied", 300],
];

// name, capacity, occupancy, status, age
const SHELTERS: readonly (readonly [string, number, number, string, number])[] = [
  ["Northbank High School", 400, 372, "Open", 600],
  ["Fairgrounds Exhibition Hall", 650, 650, "Full", 540],
  ["Cedar Park Community Centre", 180, 96, "Open", 500],
  ["Eastbank Library Annex", 90, 0, "Standby", 480],
  ["St. Aldric Parish Hall", 120, 118, "Open", 430],
  ["Old Mill Armory", 300, 0, "Closed", 700],
];

// road, reason, closed minutes ago
const CLOSURES: readonly (readonly [string, string, number])[] = [
  ["Mill Street (Harlow Bridge to 3rd Ave)", "Flooding", 310],
  ["Route 9 southbound at Eastbank", "Washout", 230],
  ["Riverside Drive", "Debris on road", 175],
  ["Cedar Lane underpass", "Standing water", 120],
];

// category, summary, minutes ago
const EVENTS: readonly (readonly [string, string, number])[] = [
  ["Operations", "Harlow River gauge at Mill Street crossed 5.2 m; level 3 maintained.", 8],
  ["Shelter", "Fairgrounds Exhibition Hall reached capacity; overflow directed to Cedar Park.", 22],
  ["Infrastructure", "Riverside Clinic switched to backup power.", 38],
  ["Operations", "Evacuation of Harlow Flats zones B and C completed.", 65],
  ["Logistics", "First sandbag convoy delivered to Eastbank levee.", 110],
  ["Planning", "Operational period 4 objectives approved by Incident Commander.", 170],
  ["Public information", "Public advisory issued for Route 9 and Mill Street closures.", 240],
];

export function createDemoRows(): Map<string, RecordEnvelope[]> {
  const tables = new Map<string, RecordEnvelope[]>();
  tables.set(
    DEMO_TABLES.resourceRequests,
    REQUESTS.map(([title, resourceType, quantity, priority, status, age], i) =>
      envelope(
        DEMO_TABLES.resourceRequests,
        rowId(1, i + 1),
        { title, resourceType, quantity, priority, status },
        age,
        Math.max(2, Math.floor(age / 3)),
      ),
    ),
  );
  tables.set(
    DEMO_TABLES.shelters,
    SHELTERS.map(([name, capacity, occupancy, status, age], i) =>
      envelope(
        DEMO_TABLES.shelters,
        rowId(2, i + 1),
        { name, capacity, occupancy, status },
        age,
        15 + i * 7,
      ),
    ),
  );
  tables.set(
    DEMO_TABLES.roadClosures,
    CLOSURES.map(([road, reason, since], i) =>
      envelope(
        DEMO_TABLES.roadClosures,
        rowId(3, i + 1),
        { road, reason, closedSince: minutesAgo(since) },
        since,
      ),
    ),
  );
  tables.set(
    DEMO_TABLES.significantEvents,
    EVENTS.map(([category, summary, ago], i) =>
      envelope(
        DEMO_TABLES.significantEvents,
        rowId(4, i + 1),
        { time: minutesAgo(ago), category, summary },
        ago,
      ),
    ),
  );
  return tables;
}

const OPEN_STATUSES = new Set(["New", "Approved", "En route"]);
const PRIORITY_ORDER = ["Critical", "High", "Normal", "Low"];
const STATUS_VIEWS: Readonly<Record<string, string>> = {
  "status-new": "New",
  "status-approved": "Approved",
  "status-en-route": "En route",
  "status-fulfilled": "Fulfilled",
};

function text(row: RecordEnvelope, key: string): string {
  const value = row.values[key];
  return typeof value === "string" ? value : "";
}

function byPriority(a: RecordEnvelope, b: RecordEnvelope): number {
  return PRIORITY_ORDER.indexOf(text(a, "priority")) - PRIORITY_ORDER.indexOf(text(b, "priority"));
}

/** Saved-view ids used by board block configs, applied in memory to the fixture rows. */
export function applyDemoView(
  tableId: string,
  viewId: string | undefined,
  rows: readonly RecordEnvelope[],
): readonly RecordEnvelope[] {
  if (tableId === DEMO_TABLES.resourceRequests) {
    if (viewId === "critical-open") {
      return rows.filter(
        (r) => text(r, "priority") === "Critical" && OPEN_STATUSES.has(text(r, "status")),
      );
    }
    if (viewId === "critical-high-open") {
      return rows
        .filter((r) => ["Critical", "High"].includes(text(r, "priority")))
        .filter((r) => OPEN_STATUSES.has(text(r, "status")))
        .toSorted(byPriority);
    }
    const status = viewId ? STATUS_VIEWS[viewId] : undefined;
    if (status) return rows.filter((r) => text(r, "status") === status).toSorted(byPriority);
    return rows;
  }
  if (tableId === DEMO_TABLES.shelters) {
    return viewId === "active-shelters" ? rows.filter((r) => text(r, "status") !== "Closed") : rows;
  }
  if (tableId === DEMO_TABLES.significantEvents) {
    return rows.toSorted((a, b) => text(b, "time").localeCompare(text(a, "time")));
  }
  return rows;
}
