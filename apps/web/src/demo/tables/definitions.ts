import type {
  FieldDefinition,
  FilterGroup,
  RecordEnvelope,
  SelectOption,
  TableDefinition,
  ViewDefinition,
} from "@argus/schema";
import {
  DEMO_INCIDENTS,
  DEMO_POSITIONS,
  DEMO_TABLES,
  DEMO_TENANT_ID,
  DEMO_USERS,
  minutesAgo,
} from "../scenario.js";

/**
 * Fictional table definitions, rows and saved views for demo mode. All values are invented.
 * Row values are keyed by field `key`; select values hold the option id (never the label).
 */

const uid = (group: string, n: number): string =>
  `${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const tableNumbers = new Map<string, number>([
  [DEMO_TABLES.resourceRequests, 1],
  [DEMO_TABLES.shelters, 2],
  [DEMO_TABLES.roadClosures, 3],
  [DEMO_TABLES.significantEvents, 4],
]);
const tt = (tableId: string): string => String(tableNumbers.get(tableId) ?? 0).padStart(2, "0");

function field(
  tableId: string,
  n: number,
  key: string,
  name: string,
  type: FieldDefinition["type"],
  config: unknown,
  options: { readonly required?: boolean; readonly description?: string } = {},
): FieldDefinition {
  return {
    id: uid(`f10000${tt(tableId)}`, n),
    key,
    name,
    description: options.description ?? null,
    required: options.required ?? false,
    unique: false,
    indexed: false,
    defaultValue: null,
    sensitivity: "standard",
    access: { defaultMode: "editable", positions: [], accessRule: null },
    type,
    config,
  } as unknown as FieldDefinition;
}

function selectOptions(
  tableId: string,
  fieldNumber: number,
  entries: readonly (readonly [string, string])[],
): SelectOption[] {
  return entries.map(([label, color], order) => ({
    id: uid(`0e0000${tt(tableId)}`, fieldNumber * 100 + order),
    label,
    color,
    order,
    archived: false,
  }));
}

const textConfig = { maxLength: null, multiline: false } as const;
const numberConfig = { precision: null, scale: 0, minimum: 0, maximum: null } as const;
const dateTimeConfig = { displayTimeZone: null, minimum: null, maximum: null } as const;
const booleanConfig = { trueLabel: "Yes", falseLabel: "No" } as const;

function optionId(f: FieldDefinition, label: string): string {
  if (f.type !== "single-select") {
    throw new Error(`Demo fixture: ${f.key} is not a single-select field`);
  }
  const match = f.config.options.find((o) => o.label === label);
  if (!match) {
    throw new Error(`Demo fixture: no option "${label}" on ${f.key}`);
  }
  return match.id;
}

const tableAccess = {
  readPositionIds: Object.values(DEMO_POSITIONS),
  createPositionIds: [
    DEMO_POSITIONS.incidentCommander,
    DEMO_POSITIONS.operationsChief,
    DEMO_POSITIONS.logisticsChief,
  ],
  updatePositionIds: [
    DEMO_POSITIONS.incidentCommander,
    DEMO_POSITIONS.operationsChief,
    DEMO_POSITIONS.logisticsChief,
    DEMO_POSITIONS.shelterManager,
  ],
  deletePositionIds: [DEMO_POSITIONS.incidentCommander],
  rowRule: null,
};

function table(
  id: string,
  key: string,
  name: string,
  description: string,
  scope: TableDefinition["incidentScope"],
  fields: readonly FieldDefinition[],
  version: number,
): TableDefinition {
  return {
    id,
    tenantId: DEMO_TENANT_ID,
    version,
    lifecycle: "published",
    changeSummary: "Demo table (fictional, in-memory).",
    createdAt: minutesAgo(60 * 24 * 30),
    createdBy: DEMO_USERS.alexMorgan,
    createdPositionId: DEMO_POSITIONS.incidentCommander,
    publishedAt: minutesAgo(60 * 24 * 30),
    publishedBy: DEMO_USERS.alexMorgan,
    key,
    name,
    description,
    physicalName: `t_demo${tt(id)}`,
    incidentScope: scope,
    fields: [...fields],
    access: tableAccess,
    softDelete: true,
    audit: true,
  };
}

// ---------------------------------------------------------------------------------------------
// Resource Requests
// ---------------------------------------------------------------------------------------------
const rrId = DEMO_TABLES.resourceRequests;
const rr = {
  number: field(rrId, 1, "request_number", "Request #", "text", textConfig, { required: true }),
  title: field(rrId, 2, "title", "Title", "text", textConfig, { required: true }),
  type: field(rrId, 3, "resource_type", "Resource type", "single-select", {
    options: selectOptions(rrId, 3, [
      ["Sandbags", "#A16207"],
      ["Pumps", "#0369A1"],
      ["Generators", "#C2410C"],
      ["Water", "#0E7490"],
      ["Medical", "#BE123C"],
      ["Personnel", "#6D28D9"],
      ["Boats", "#1D4ED8"],
    ]),
  }),
  quantity: field(rrId, 4, "quantity", "Quantity", "number", numberConfig),
  priority: field(
    rrId,
    5,
    "priority",
    "Priority",
    "single-select",
    {
      options: selectOptions(rrId, 5, [
        ["Critical", "#B91C1C"],
        ["High", "#C2410C"],
        ["Normal", "#475569"],
        ["Low", "#64748B"],
      ]),
    },
    { required: true },
  ),
  status: field(
    rrId,
    6,
    "status",
    "Status",
    "single-select",
    {
      options: selectOptions(rrId, 6, [
        ["New", "#1D4ED8"],
        ["Approved", "#0F766E"],
        ["En route", "#7C3AED"],
        ["Fulfilled", "#15803D"],
        ["Denied", "#6B7280"],
      ]),
    },
    { required: true },
  ),
  requestedBy: field(rrId, 7, "requested_by", "Requested by", "text", textConfig),
  neededBy: field(rrId, 8, "needed_by", "Needed by", "date-time", dateTimeConfig),
  notes: field(rrId, 9, "notes", "Notes", "long-text", { format: "plain" }),
};
const rrFields = Object.values(rr);

type RrRow = readonly [
  n: number,
  title: string,
  type: string,
  qty: number,
  priority: string,
  status: string,
  by: string,
  neededInMinutes: number,
  notes: string | null,
  createdMinutesAgo: number,
];
const rrRows: readonly RrRow[] = [
  [
    4101,
    "Sandbags for Millrace Road levee",
    "Sandbags",
    5000,
    "Critical",
    "En route",
    "Jordan Lee",
    90,
    "Staging at Station 4; crew of 12 on site.",
    380,
  ],
  [
    4102,
    "High-volume pumps, Eastgate underpass",
    "Pumps",
    4,
    "Critical",
    "Approved",
    "Sam Rivera",
    45,
    "Needs 6 inch discharge hose.",
    340,
  ],
  [
    4103,
    "Generators for Harlow High shelter",
    "Generators",
    2,
    "High",
    "Fulfilled",
    "Casey Nguyen",
    -60,
    "Delivered and fuelled.",
    620,
  ],
  [4104, "Bottled water, pallets", "Water", 30, "High", "En route", "Casey Nguyen", 180, null, 300],
  [
    4105,
    "Paramedic unit for Riverside Community Hall",
    "Medical",
    1,
    "High",
    "Approved",
    "Priya Shah",
    120,
    "Overnight coverage, 12 hours.",
    260,
  ],
  [
    4106,
    "Volunteer sandbag crew",
    "Personnel",
    40,
    "Normal",
    "New",
    "Jordan Lee",
    360,
    "Coordinate with the volunteer centre.",
    220,
  ],
  [
    4107,
    "Rescue boats, North Bank district",
    "Boats",
    3,
    "Critical",
    "Approved",
    "Sam Rivera",
    30,
    "Swift-water trained crews only.",
    205,
  ],
  [
    4108,
    "Sandbags for Willow Court",
    "Sandbags",
    1200,
    "High",
    "New",
    "Alex Morgan",
    240,
    null,
    170,
  ],
  [
    4109,
    "Portable pump, Old Mill basement",
    "Pumps",
    1,
    "Normal",
    "Fulfilled",
    "Jordan Lee",
    -240,
    null,
    700,
  ],
  [
    4110,
    "Insulin cold-chain cooler units",
    "Medical",
    6,
    "Critical",
    "En route",
    "Priya Shah",
    60,
    "Hand delivery to Lakeview shelter.",
    150,
  ],
  [
    4111,
    "Diesel for backup generators",
    "Generators",
    800,
    "Normal",
    "Approved",
    "Casey Nguyen",
    300,
    "Litres; two tanker drops.",
    130,
  ],
  [4112, "Traffic control personnel", "Personnel", 8, "Normal", "New", "Sam Rivera", 150, null, 95],
  [
    4113,
    "Pet food and crates",
    "Water",
    1,
    "Low",
    "Denied",
    "Casey Nguyen",
    480,
    "Covered by animal services; duplicate request.",
    80,
  ],
  [
    4114,
    "Light towers for Eastgate staging area",
    "Generators",
    3,
    "High",
    "New",
    "Jordan Lee",
    200,
    null,
    40,
  ],
  [
    4115,
    "Sandbags, Harlow Falls library",
    "Sandbags",
    600,
    "Low",
    "New",
    "Alex Morgan",
    720,
    "Protective only; no standing water yet.",
    15,
  ],
];

// ---------------------------------------------------------------------------------------------
// Shelters (global: standing facilities shared across incidents)
// ---------------------------------------------------------------------------------------------
const shId = DEMO_TABLES.shelters;
const sh = {
  name: field(shId, 1, "name", "Shelter", "text", textConfig, { required: true }),
  address: field(shId, 2, "address", "Address", "text", textConfig),
  capacity: field(shId, 3, "capacity", "Capacity", "number", numberConfig),
  occupancy: field(shId, 4, "occupancy", "Occupancy", "number", numberConfig),
  status: field(
    shId,
    5,
    "status",
    "Status",
    "single-select",
    {
      options: selectOptions(shId, 5, [
        ["Open", "#15803D"],
        ["Full", "#B91C1C"],
        ["Standby", "#B45309"],
        ["Closed", "#6B7280"],
      ]),
    },
    { required: true },
  ),
  pets: field(shId, 6, "pets_allowed", "Pets allowed", "boolean", booleanConfig),
  accessible: field(shId, 7, "accessible", "Accessible", "boolean", booleanConfig),
  manager: field(shId, 8, "manager", "Manager", "text", textConfig),
};
const shFields = Object.values(sh);

type ShRow = readonly [
  name: string,
  address: string,
  capacity: number,
  occupancy: number,
  status: string,
  pets: boolean,
  accessible: boolean,
  manager: string,
  updatedMinutesAgo: number,
];
const shRows: readonly ShRow[] = [
  [
    "Harlow High School Gymnasium",
    "210 Schoolhouse Lane, Harlow Falls",
    250,
    187,
    "Open",
    false,
    true,
    "Priya Shah",
    12,
  ],
  [
    "Riverside Community Hall",
    "18 Quay Street, Riverside",
    120,
    120,
    "Full",
    true,
    true,
    "Dana Whitfield",
    25,
  ],
  [
    "Lakeview Recreation Centre",
    "902 Lakeview Drive, Northbank",
    300,
    96,
    "Open",
    true,
    true,
    "Marcus Bell",
    40,
  ],
  [
    "Saint Aldric Parish Hall",
    "44 Chapel Row, Harlow Falls",
    80,
    0,
    "Standby",
    false,
    false,
    "Elena Ruiz",
    180,
  ],
  [
    "Northbank Fairgrounds Pavilion",
    "1 Fairground Road, Northbank",
    400,
    212,
    "Open",
    true,
    true,
    "Tomas Eriksen",
    8,
  ],
  [
    "Willowmere Library Annex",
    "7 Willow Court, Willowmere",
    60,
    0,
    "Closed",
    false,
    true,
    "Grace Okafor",
    600,
  ],
  [
    "Eastgate Arena Concourse",
    "3300 Eastgate Boulevard, Eastgate",
    500,
    0,
    "Standby",
    true,
    true,
    "Marcus Bell",
    95,
  ],
  [
    "Millrace Elementary School",
    "55 Millrace Road, Harlow Falls",
    150,
    141,
    "Open",
    false,
    true,
    "Dana Whitfield",
    5,
  ],
];

// ---------------------------------------------------------------------------------------------
// Road Closures
// ---------------------------------------------------------------------------------------------
const rcId = DEMO_TABLES.roadClosures;
const rc = {
  road: field(rcId, 1, "road", "Road", "text", textConfig, { required: true }),
  segment: field(rcId, 2, "segment", "Segment", "text", textConfig),
  reason: field(rcId, 3, "reason", "Reason", "single-select", {
    options: selectOptions(rcId, 3, [
      ["Flooding", "#0369A1"],
      ["Washout", "#A16207"],
      ["Debris", "#6B7280"],
      ["Bridge damage", "#B91C1C"],
      ["Power lines down", "#C2410C"],
    ]),
  }),
  closedSince: field(rcId, 4, "closed_since", "Closed since", "date-time", dateTimeConfig),
  reopening: field(
    rcId,
    5,
    "expected_reopening",
    "Expected reopening",
    "date-time",
    dateTimeConfig,
  ),
  detour: field(rcId, 6, "detour", "Detour", "text", textConfig),
};
const rcFields = Object.values(rc);

type RcRow = readonly [
  road: string,
  segment: string,
  reason: string,
  closedMinutesAgo: number,
  reopenInMinutes: number | null,
  detour: string,
];
const rcRows: readonly RcRow[] = [
  [
    "Millrace Road",
    "Weir Bridge to Station 4",
    "Flooding",
    420,
    null,
    "Use Hillcrest Avenue via Chapel Row.",
  ],
  [
    "Eastgate Underpass",
    "Eastgate Blvd at Rail Street",
    "Flooding",
    360,
    1_440,
    "Use Overpass Road, add 6 minutes.",
  ],
  [
    "Route 9",
    "Mile 14 to Mile 16",
    "Washout",
    300,
    4_320,
    "Detour via County Road 22, trucks prohibited.",
  ],
  [
    "Quay Street",
    "Harbor Lane to Ferry Steps",
    "Flooding",
    280,
    720,
    "Pedestrian access only; no vehicle detour.",
  ],
  ["Willow Court", "Entire street", "Debris", 240, 360, "Residents access from Pine Terrace."],
  [
    "Harlow Bridge",
    "Northbound lane",
    "Bridge damage",
    200,
    null,
    "Southbound lane open with flaggers; inspection pending.",
  ],
  [
    "Lakeview Drive",
    "Pier Road to Lakeview Rec Centre",
    "Power lines down",
    150,
    240,
    "Use Ridge Road; utility crew on site.",
  ],
  [
    "County Road 22",
    "Fairground Road junction",
    "Debris",
    110,
    180,
    "One lane open, expect delays.",
  ],
  [
    "Mill Lane",
    "Old Mill to Canal Street",
    "Flooding",
    75,
    1_000,
    "Use Canal Street via Chapel Row.",
  ],
  [
    "Schoolhouse Lane",
    "Elm Street to Harlow High",
    "Flooding",
    30,
    600,
    "Emergency and shelter traffic only via Elm Street.",
  ],
];

// ---------------------------------------------------------------------------------------------
// Significant Events
// ---------------------------------------------------------------------------------------------
const seId = DEMO_TABLES.significantEvents;
const se = {
  time: field(seId, 1, "event_time", "Time", "date-time", dateTimeConfig, { required: true }),
  category: field(seId, 2, "category", "Category", "single-select", {
    options: selectOptions(seId, 2, [
      ["Weather", "#0369A1"],
      ["Infrastructure", "#A16207"],
      ["Evacuation", "#B91C1C"],
      ["Shelter", "#15803D"],
      ["Resources", "#6D28D9"],
      ["Communications", "#0E7490"],
      ["Safety", "#C2410C"],
    ]),
  }),
  summary: field(
    seId,
    3,
    "summary",
    "Summary",
    "long-text",
    { format: "plain" },
    { required: true },
  ),
  reportedBy: field(seId, 4, "reported_by", "Reported by", "text", textConfig),
};
const seFields = Object.values(se);

type SeRow = readonly [minutesAgo: number, category: string, summary: string, reportedBy: string];
const seRows: readonly SeRow[] = [
  [
    900,
    "Weather",
    "Flood watch issued for the Harlow River basin; 60 mm of rain forecast over 24 hours.",
    "Priya Shah",
  ],
  [
    780,
    "Communications",
    "Emergency operations centre activated at level 2; staff recall begun.",
    "Alex Morgan",
  ],
  [
    640,
    "Infrastructure",
    "River gauge at Weir Bridge passes action stage (3.2 m) and is still rising.",
    "Sam Rivera",
  ],
  [
    540,
    "Evacuation",
    "Voluntary evacuation advised for Millrace Road and Willow Court residents.",
    "Alex Morgan",
  ],
  [
    470,
    "Shelter",
    "Harlow High School gymnasium opened as the first reception shelter.",
    "Priya Shah",
  ],
  [420, "Infrastructure", "Millrace Road closed at Weir Bridge due to overtopping.", "Jordan Lee"],
  [
    340,
    "Evacuation",
    "Mandatory evacuation ordered for Quay Street and Riverside low-lying blocks.",
    "Alex Morgan",
  ],
  [
    300,
    "Infrastructure",
    "Route 9 washout reported near Mile 15; public works dispatched.",
    "Sam Rivera",
  ],
  [
    230,
    "Safety",
    "Two swift-water rescues completed at Eastgate underpass; no injuries.",
    "Sam Rivera",
  ],
  [
    150,
    "Resources",
    "Mutual aid confirmed: 3 rescue boats and 8 crew from neighbouring county.",
    "Casey Nguyen",
  ],
  [
    70,
    "Shelter",
    "Riverside Community Hall reached capacity; overflow routed to Lakeview Recreation Centre.",
    "Priya Shah",
  ],
  [
    20,
    "Weather",
    "Rainfall easing; river forecast to crest at 4.1 m in roughly six hours.",
    "Priya Shah",
  ],
];

// ---------------------------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------------------------
const creators = [
  [DEMO_USERS.alexMorgan, DEMO_POSITIONS.incidentCommander],
  [DEMO_USERS.priyaShah, DEMO_POSITIONS.planningChief],
  [DEMO_USERS.jordanLee, DEMO_POSITIONS.operationsChief],
  [DEMO_USERS.samRivera, DEMO_POSITIONS.operationsChief],
  [DEMO_USERS.caseyNguyen, DEMO_POSITIONS.logisticsChief],
] as const;

function envelope(
  tableId: string,
  incidentId: string | null,
  n: number,
  createdMinutesAgo: number,
  updatedMinutesAgo: number,
  values: Record<string, unknown>,
): RecordEnvelope {
  const creator = creators[n % creators.length] ?? creators[0];
  const updater = creators[(n + 2) % creators.length] ?? creators[0];
  const edited = updatedMinutesAgo < createdMinutesAgo;
  return {
    id: uid(`a10000${tt(tableId)}`, n),
    tenantId: DEMO_TENANT_ID,
    tableId,
    incidentId,
    values,
    createdAt: minutesAgo(createdMinutesAgo),
    createdBy: creator[0],
    createdPositionId: creator[1],
    updatedAt: minutesAgo(edited ? updatedMinutesAgo : createdMinutesAgo),
    updatedBy: edited ? updater[0] : creator[0],
    updatedPositionId: edited ? updater[1] : creator[1],
    version: edited ? 2 : 1,
    deletedAt: null,
  };
}

const incident = DEMO_INCIDENTS.harlowFlood;

export function createDemoTables(): TableDefinition[] {
  return [
    table(
      rrId,
      "resource_requests",
      "Resource Requests",
      "Requests for equipment, supplies and personnel for the Harlow River flood response.",
      "incident",
      rrFields,
      3,
    ),
    table(
      shId,
      "shelters",
      "Shelters",
      "Standing shelter facilities with live capacity and occupancy.",
      "global",
      shFields,
      2,
    ),
    table(
      rcId,
      "road_closures",
      "Road Closures",
      "Roads closed or restricted during the incident, with detours.",
      "incident",
      rcFields,
      2,
    ),
    table(
      seId,
      "significant_events",
      "Significant Events",
      "Chronological log of significant events for the situation report.",
      "incident",
      seFields,
      1,
    ),
  ];
}

export function createDemoRows(): Map<string, RecordEnvelope[]> {
  const rows = new Map<string, RecordEnvelope[]>();

  rows.set(
    rrId,
    rrRows.map(([n, title, type, qty, priority, status, by, needed, notes, created]) =>
      envelope(rrId, incident, n, created, Math.max(1, Math.round(created / 3)), {
        [rr.number.key]: `RR-${n}`,
        [rr.title.key]: title,
        [rr.type.key]: optionId(rr.type, type),
        [rr.quantity.key]: qty,
        [rr.priority.key]: optionId(rr.priority, priority),
        [rr.status.key]: optionId(rr.status, status),
        [rr.requestedBy.key]: by,
        [rr.neededBy.key]: minutesAgo(-needed),
        [rr.notes.key]: notes,
      }),
    ),
  );

  rows.set(
    shId,
    shRows.map(([name, address, capacity, occupancy, status, pets, accessible, manager, upd], i) =>
      envelope(shId, null, i + 1, 60 * 24 * 14, upd, {
        [sh.name.key]: name,
        [sh.address.key]: address,
        [sh.capacity.key]: capacity,
        [sh.occupancy.key]: occupancy,
        [sh.status.key]: optionId(sh.status, status),
        [sh.pets.key]: pets,
        [sh.accessible.key]: accessible,
        [sh.manager.key]: manager,
      }),
    ),
  );

  rows.set(
    rcId,
    rcRows.map(([road, segment, reason, closed, reopen, detour], i) =>
      envelope(rcId, incident, i + 1, closed, closed, {
        [rc.road.key]: road,
        [rc.segment.key]: segment,
        [rc.reason.key]: optionId(rc.reason, reason),
        [rc.closedSince.key]: minutesAgo(closed),
        [rc.reopening.key]: reopen === null ? null : minutesAgo(-reopen),
        [rc.detour.key]: detour,
      }),
    ),
  );

  rows.set(
    seId,
    seRows.map(([ago, category, summary, by], i) =>
      envelope(seId, incident, i + 1, ago, ago, {
        [se.time.key]: minutesAgo(ago),
        [se.category.key]: optionId(se.category, category),
        [se.summary.key]: summary,
        [se.reportedBy.key]: by,
      }),
    ),
  );

  return rows;
}

function view(
  tableId: string,
  n: number,
  name: string,
  parts: Pick<ViewDefinition, "filters" | "sorts" | "grouping" | "fieldOrder" | "hiddenFieldIds">,
): ViewDefinition {
  return {
    id: uid(`b10000${tt(tableId)}`, n),
    tenantId: DEMO_TENANT_ID,
    version: 1,
    lifecycle: "published",
    changeSummary: null,
    createdAt: minutesAgo(60 * 24 * 20),
    createdBy: DEMO_USERS.alexMorgan,
    createdPositionId: DEMO_POSITIONS.incidentCommander,
    publishedAt: minutesAgo(60 * 24 * 20),
    publishedBy: DEMO_USERS.alexMorgan,
    tableId,
    name,
    kind: "grid",
    colorRules: [],
    access: { positionIds: [], visibilityRule: null },
    publicForm: false,
    ...parts,
  };
}

const and = (conditions: FilterGroup["conditions"]): FilterGroup => ({
  conjunction: "and",
  conditions,
  groups: [],
});

export function createDemoViews(): Map<string, ViewDefinition[]> {
  const views = new Map<string, ViewDefinition[]>();
  const ascending = (fieldId: string) =>
    ({ fieldId, direction: "ascending", nulls: "last" }) as const;

  views.set(rrId, [
    view(rrId, 1, "Urgent and open", {
      filters: and([
        {
          fieldId: rr.priority.id,
          operator: "in",
          value: [optionId(rr.priority, "Critical"), optionId(rr.priority, "High")],
        },
        {
          fieldId: rr.status.id,
          operator: "not-in",
          value: [optionId(rr.status, "Fulfilled"), optionId(rr.status, "Denied")],
        },
      ]),
      sorts: [ascending(rr.neededBy.id)],
      grouping: null,
      fieldOrder: [],
      hiddenFieldIds: [rr.notes.id],
    }),
    view(rrId, 2, "By status", {
      filters: null,
      sorts: [ascending(rr.priority.id)],
      grouping: { fieldId: rr.status.id, direction: "ascending", collapsed: false },
      fieldOrder: [],
      hiddenFieldIds: [],
    }),
  ]);
  views.set(shId, [
    view(shId, 1, "Open shelters", {
      filters: and([
        { fieldId: sh.status.id, operator: "equals", value: optionId(sh.status, "Open") },
      ]),
      sorts: [ascending(sh.name.id)],
      grouping: null,
      fieldOrder: [],
      hiddenFieldIds: [sh.address.id],
    }),
  ]);
  views.set(rcId, [
    view(rcId, 1, "Open-ended closures", {
      filters: and([{ fieldId: rc.reopening.id, operator: "is-empty", value: null }]),
      sorts: [ascending(rc.closedSince.id)],
      grouping: null,
      fieldOrder: [],
      hiddenFieldIds: [],
    }),
    view(rcId, 2, "By reason", {
      filters: null,
      sorts: [],
      grouping: { fieldId: rc.reason.id, direction: "ascending", collapsed: false },
      fieldOrder: [],
      hiddenFieldIds: [],
    }),
  ]);
  views.set(seId, [
    view(seId, 1, "Newest first", {
      filters: null,
      sorts: [{ fieldId: se.time.id, direction: "descending", nulls: "last" }],
      grouping: null,
      fieldOrder: [],
      hiddenFieldIds: [],
    }),
  ]);
  return views;
}
