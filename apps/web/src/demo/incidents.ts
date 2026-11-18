import type { Incident } from "@argus/schema";
import type { IncidentsSource } from "../features/incidents/incidents-source.js";
import { DEMO_INCIDENTS, DEMO_TENANT_ID, demoDelay, minutesAgo } from "./scenario.js";
import { notifyDemoChange } from "./services.js";

const DAY = 24 * 60;

const incidents: readonly Incident[] = [
  {
    id: DEMO_INCIDENTS.harlowFlood,
    tenantId: DEMO_TENANT_ID,
    key: "harlow_river_flood",
    name: "Harlow River Flood",
    kind: "live",
    status: "active",
    level: 3,
    operationalPeriod: "OP 4 · 18 Nov 06:00–18:00",
    activatedAt: minutesAgo(3 * DAY + 120),
    closedAt: null,
    createdAt: minutesAgo(3 * DAY + 130),
    updatedAt: minutesAgo(12),
  },
  {
    id: DEMO_INCIDENTS.stormWatch,
    tenantId: DEMO_TENANT_ID,
    key: "coastal_storm_watch",
    name: "Coastal Storm Watch",
    kind: "live",
    status: "monitoring",
    level: 1,
    operationalPeriod: "OP 1 · 18 Nov 00:00–24:00",
    activatedAt: minutesAgo(DAY),
    closedAt: null,
    createdAt: minutesAgo(DAY + 30),
    updatedAt: minutesAgo(95),
  },
  {
    id: DEMO_INCIDENTS.chemicalSpill,
    tenantId: DEMO_TENANT_ID,
    key: "westgate_chemical_spill",
    name: "Westgate Chemical Spill",
    kind: "live",
    status: "closed",
    level: 2,
    operationalPeriod: null,
    activatedAt: minutesAgo(40 * DAY),
    closedAt: minutesAgo(36 * DAY),
    createdAt: minutesAgo(40 * DAY + 20),
    updatedAt: minutesAgo(36 * DAY),
  },
  {
    id: DEMO_INCIDENTS.wildfireExercise,
    tenantId: DEMO_TENANT_ID,
    key: "operation_ember",
    name: "Wildfire Exercise: Operation Ember",
    kind: "exercise",
    status: "active",
    level: 2,
    operationalPeriod: "OP 1 · 18 Nov 09:00–15:00",
    activatedAt: minutesAgo(180),
    closedAt: null,
    createdAt: minutesAgo(10 * DAY),
    updatedAt: minutesAgo(20),
  },
  {
    id: DEMO_INCIDENTS.winterExercise,
    tenantId: DEMO_TENANT_ID,
    key: "winter_readiness_exercise",
    name: "Winter Readiness Exercise",
    kind: "exercise",
    status: "planned",
    level: null,
    operationalPeriod: null,
    activatedAt: null,
    closedAt: null,
    createdAt: minutesAgo(5 * DAY),
    updatedAt: minutesAgo(2 * DAY),
  },
];

/** Id last picked in the switcher. The demo scope itself stays fixed on the Harlow flood. */
let activeIncidentId: string = DEMO_INCIDENTS.harlowFlood;

/** In-memory incidents for demo mode. */
export const demoIncidentsSource: IncidentsSource = {
  list: () => demoDelay(incidents),
  switchActive: async (_scope, incidentId) => {
    await demoDelay(undefined, 200);
    activeIncidentId = incidentId;
    notifyDemoChange("incidents");
  },
};

/** Last incident chosen in the demo switcher (informational only). */
export function getDemoActiveIncidentId(): string {
  return activeIncidentId;
}
