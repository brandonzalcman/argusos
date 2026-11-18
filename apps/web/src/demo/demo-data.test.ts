import {
  alertInstanceSchema,
  boardDefinitionSchema,
  incidentSchema,
  layoutDefinitionSchema,
  mapDefinitionSchema,
  menuDefinitionSchema,
  positionSchema,
  recordEnvelopeSchema,
  sessionSnapshotSchema,
  studioDefinitionSummarySchema,
  studioDocumentSchema,
  studioVersionSummarySchema,
  tableDefinitionSchema,
  themeDefinitionSchema,
  viewDefinitionSchema,
  workflowDefinitionSchema,
  workflowRunSchema,
} from "@argus/schema";
import { describe, expect, it } from "vitest";
import type { LiveRowsEvent, LiveValueEvent } from "../features/tables/tables-port.js";
import { createDemoAdminService } from "./admin.js";
import { demoAlertsSource } from "./alerts.js";
import { createDemoBoardsEnvironment } from "./boards/index.js";
import { demoIncidentsSource } from "./incidents.js";
import { demoMapsSource } from "./maps.js";
import { DEMO_ACTOR, DEMO_INCIDENTS, DEMO_POSITIONS, DEMO_SCOPE } from "./scenario.js";
import { createDemoSessionPort, createDemoStudioPort } from "./studio/index.js";
import { createDemoTablesDataPort } from "./tables/index.js";
import { createDemoWorkflowService } from "./workflows.js";

/** Resolves with the first event a demo subscription emits. */
function firstEvent<E>(subscribe: (listener: (event: E) => void) => () => void): Promise<E> {
  return new Promise((resolve) => {
    const unsubscribe = subscribe((event) => {
      unsubscribe();
      resolve(event);
    });
  });
}

// Demo data must satisfy the real contracts so the UI is exercised exactly as it will be in production.
describe("demo data conforms to @argus/schema", () => {
  it("incidents, alerts and maps", async () => {
    const incidents = await demoIncidentsSource.list(DEMO_SCOPE);
    expect(incidents.length).toBeGreaterThan(0);
    for (const incident of incidents) incidentSchema.parse(incident);

    const deliveries = await demoAlertsSource.listDeliveries(DEMO_SCOPE);
    expect(deliveries.length).toBeGreaterThan(0);
    for (const row of deliveries) alertInstanceSchema.parse(row.alert);

    const maps = await demoMapsSource.listMaps(DEMO_SCOPE);
    expect(maps.length).toBeGreaterThan(0);
    for (const map of maps) mapDefinitionSchema.parse(map);
  });

  it("tables, rows and views", async () => {
    const port = createDemoTablesDataPort();
    const catalog = await firstEvent<LiveValueEvent<readonly unknown[]>>((l) =>
      port.subscribeCatalog(l),
    );
    if (catalog.kind !== "value") throw new Error(`catalog emitted ${catalog.kind}`);
    expect(catalog.value.length).toBeGreaterThan(0);
    for (const raw of catalog.value) {
      const table = tableDefinitionSchema.parse(raw);
      const rows = await firstEvent<LiveRowsEvent>((l) => port.subscribeRows(table.id, l));
      if (rows.kind !== "snapshot") throw new Error(`rows emitted ${rows.kind}`);
      expect(rows.rows.length).toBeGreaterThan(0);
      for (const row of rows.rows) recordEnvelopeSchema.parse(row);
      const views = await firstEvent<LiveValueEvent<readonly unknown[]>>((l) =>
        port.subscribeViews(table.id, l),
      );
      if (views.kind !== "value") throw new Error(`views emitted ${views.kind}`);
      for (const view of views.value) viewDefinitionSchema.parse(view);
    }
  });

  it("boards and layouts", async () => {
    const { scope, repository } = createDemoBoardsEnvironment();
    if (!scope) throw new Error("demo boards environment has no scope");
    const boards = await repository.list(scope);
    expect(boards.length).toBeGreaterThan(0);
    for (const summary of boards) {
      const bundle = await repository.getPublished(scope, summary.id);
      boardDefinitionSchema.parse(bundle.definition);
      layoutDefinitionSchema.parse(bundle.layout);
    }
  });

  it("admin definitions", async () => {
    const admin = createDemoAdminService();
    for (const position of await admin.listPositions(DEMO_SCOPE)) positionSchema.parse(position);
    themeDefinitionSchema.parse(await admin.getTheme(DEMO_SCOPE));
    menuDefinitionSchema.parse(await admin.getMenu(DEMO_SCOPE));
    for (const layout of await admin.listHomepages(DEMO_SCOPE))
      layoutDefinitionSchema.parse(layout);
    await expect(admin.getPreferences(DEMO_SCOPE, DEMO_ACTOR)).resolves.toBeDefined();
  });

  it("workflows and runs", async () => {
    const service = createDemoWorkflowService();
    const workflows = await service.listWorkflows(DEMO_SCOPE);
    expect(workflows.length).toBeGreaterThan(0);
    for (const workflow of workflows) {
      workflowDefinitionSchema.parse(workflow);
      for (const run of await service.listRuns(DEMO_SCOPE, workflow.id))
        workflowRunSchema.parse(run);
    }
  });
});

describe("demo studio data conforms to @argus/schema", () => {
  it("session snapshots for every position and incident", async () => {
    const session = createDemoSessionPort(0);
    const first = sessionSnapshotSchema.parse(await session.get());
    expect(first.activeIncident?.name).toBe("Harlow River Flood");
    expect(first.studio).toEqual({
      viewStudio: true,
      editDefinitions: true,
      publishDefinitions: true,
      editCode: true,
    });
    for (const position of first.availablePositions) {
      const snapshot = sessionSnapshotSchema.parse(
        await session.selectPosition({ positionId: position.id }),
      );
      expect(snapshot.position.id).toBe(position.id);
    }
    const shelter = await session.selectPosition({ positionId: DEMO_POSITIONS.shelterManager });
    expect(shelter.studio.viewStudio).toBe(false);
    const switched = await session.selectIncident({ incidentId: DEMO_INCIDENTS.stormWatch });
    expect(sessionSnapshotSchema.parse(switched).activeIncident?.id).toBe(
      DEMO_INCIDENTS.stormWatch,
    );
  });

  it("seeded boards, pages and components", async () => {
    const studio = createDemoStudioPort(createDemoSessionPort(0), { latencyMs: 0 });
    for (const kind of ["board", "page", "component"] as const) {
      const list = await studio.list({ kind, search: null, cursor: null, limit: 50 });
      expect(list.items.length).toBeGreaterThan(0);
      for (const summary of list.items) {
        studioDefinitionSummarySchema.parse(summary);
        for (const version of await studio.listVersions({ kind, id: summary.id })) {
          studioVersionSummarySchema.parse(version);
          const got = await studio.get({ kind, id: summary.id, revision: version.version });
          const document = studioDocumentSchema.parse(got?.document);
          expect((await studio.validate({ document })).issues).toEqual([]);
        }
      }
    }
  });
});
