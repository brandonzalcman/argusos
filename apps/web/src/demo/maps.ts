import type { MapDefinition, MapLayerDefinition, ViewAccessPolicy } from "@argus/schema";
import type { MapsSource } from "../features/maps/maps-source.js";
import {
  DEMO_ACTOR,
  DEMO_MAP_CENTER,
  DEMO_MAPS,
  DEMO_POSITIONS,
  DEMO_TABLES,
  DEMO_TENANT_ID,
  demoDelay,
  minutesAgo,
} from "./scenario.js";

const access: ViewAccessPolicy = { positionIds: [], visibilityRule: null };
const { longitude: lng, latitude: lat } = DEMO_MAP_CENTER;

function point(name: string, dx: number, dy: number) {
  return {
    type: "Feature",
    properties: { name },
    geometry: { type: "Point", coordinates: [lng + dx, lat + dy] },
  };
}

const layerBase = { minimumZoom: null, maximumZoom: null, access };

/** Listed bottom-first; the panel shows the last entry on top. */
const layers: MapLayerDefinition[] = [
  {
    ...layerBase,
    id: "7a100000-0000-4000-8000-000000000001",
    name: "Flood extent (modelled)",
    source: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Harlow River inundation, 18 Nov 06:00" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [lng - 0.03, lat - 0.01],
                  [lng - 0.01, lat + 0.012],
                  [lng + 0.02, lat + 0.008],
                  [lng + 0.035, lat - 0.012],
                  [lng - 0.03, lat - 0.01],
                ],
              ],
            },
          },
        ],
      },
    },
    visible: true,
    opacity: 0.5,
    style: { fillColor: "#2563eb", lineColor: "#1d4ed8" },
  },
  {
    ...layerBase,
    id: "7a100000-0000-4000-8000-000000000002",
    name: "Shelters",
    source: {
      type: "board-records",
      tableId: DEMO_TABLES.shelters,
      locationFieldId: "7a200000-0000-4000-8000-000000000001",
      filterExpression: null,
    },
    visible: true,
    opacity: 1,
    style: { circleColor: "#16a34a", icon: "shelter" },
  },
  {
    ...layerBase,
    id: "7a100000-0000-4000-8000-000000000003",
    name: "Road closures",
    source: {
      type: "board-records",
      tableId: DEMO_TABLES.roadClosures,
      locationFieldId: "7a200000-0000-4000-8000-000000000002",
      filterExpression: null,
    },
    visible: true,
    opacity: 1,
    style: { lineColor: "#dc2626", lineWidth: 3 },
  },
  {
    ...layerBase,
    id: "7a100000-0000-4000-8000-000000000004",
    name: "Resource staging areas",
    source: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          point("Staging Alpha (fictional)", -0.02, 0.02),
          point("Staging Bravo (fictional)", 0.025, 0.018),
        ],
      },
    },
    visible: false,
    opacity: 0.9,
    style: { circleColor: "#f59e0b" },
  },
  {
    ...layerBase,
    id: "7a100000-0000-4000-8000-000000000005",
    name: "Responder positions",
    source: { type: "live-feed", feedId: "7a300000-0000-4000-8000-000000000001", latestOnly: true },
    visible: false,
    opacity: 1,
    style: { circleColor: "#7c3aed" },
  },
];

const definition: MapDefinition = {
  id: DEMO_MAPS.commonOperatingPicture,
  tenantId: DEMO_TENANT_ID,
  version: 3,
  lifecycle: "published",
  changeSummary: "Demo: added modelled flood extent layer.",
  createdAt: minutesAgo(5 * 24 * 60),
  createdBy: DEMO_ACTOR.userId,
  createdPositionId: DEMO_POSITIONS.planningChief,
  publishedAt: minutesAgo(60),
  publishedBy: DEMO_ACTOR.userId,
  name: "Common operating picture",
  center: [lng, lat],
  zoom: 12,
  layers,
  annotationsTableId: null,
  access,
};

/** In-memory map definitions for demo mode. */
export const demoMapsSource: MapsSource = {
  listMaps: () => demoDelay([definition]),
};
