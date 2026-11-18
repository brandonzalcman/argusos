import type { AlertInstance, Incident, MapDefinition } from "@argus/schema";

/** TEST FIXTURES ONLY: invented values for unit tests; never import from application code. */
export const fixtureIncident = (overrides: Partial<Incident>): Incident => ({
  id: "fixture-incident",
  tenantId: "fixture-tenant",
  key: "fixture-incident",
  name: "Fixture incident",
  kind: "live",
  status: "active",
  level: 2,
  operationalPeriod: null,
  activatedAt: "2026-01-01T10:00:00.000Z",
  closedAt: null,
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-01T09:00:00.000Z",
  ...overrides,
});

export const fixtureAlert = (overrides: Partial<AlertInstance>): AlertInstance => ({
  id: "fixture-alert",
  tenantId: "fixture-tenant",
  incidentId: "fixture-incident",
  definitionId: "fixture-definition",
  definitionVersion: 1,
  severity: "major",
  status: "delivered",
  raisedAt: "2026-01-01T10:00:00.000Z",
  acknowledgedAt: null,
  acknowledgedBy: null,
  acknowledgedPositionId: null,
  ...overrides,
});

export const fixtureMapDefinition = (layerVisibility: readonly boolean[]): MapDefinition =>
  ({
    center: [10, 20],
    zoom: 5,
    layers: layerVisibility.map((visible, index) => ({
      id: `fixture-layer-${index}`,
      name: `Fixture layer ${index}`,
      visible,
      source: { type: "geojson", data: null },
    })),
  }) as unknown as MapDefinition;
