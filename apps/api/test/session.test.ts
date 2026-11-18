import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSystemTransaction } from "../src/db/transaction.js";
import { sessionContexts, sessionEvents } from "../src/persistence/system-schema.js";
import {
  createLoginUser,
  createTestApp,
  setUserStatus,
  signIn,
  type TestApp,
  trpcMutation,
  trpcQuery,
} from "./helpers/auth.js";
import { createIncident, createPosition, createTenant } from "./helpers/index.js";

interface Snapshot {
  user: { id: string; tenantId: string; displayName: string };
  tenant: { id: string };
  position: { id: string; key: string };
  availablePositions: { id: string; key: string }[];
  activeIncident: { id: string } | null;
  studio: {
    viewStudio: boolean;
    editDefinitions: boolean;
    publishDefinitions: boolean;
    editCode: boolean;
  };
}

function snapshotOf(data: unknown): Snapshot {
  return data as Snapshot;
}

describe("session API", () => {
  let test: TestApp;
  let tenantA: Awaited<ReturnType<typeof createTenant>>;
  let tenantB: Awaited<ReturnType<typeof createTenant>>;
  let builder: Awaited<ReturnType<typeof createPosition>>;
  let viewer: Awaited<ReturnType<typeof createPosition>>;
  let foreignPosition: Awaited<ReturnType<typeof createPosition>>;
  let unassigned: Awaited<ReturnType<typeof createPosition>>;
  let incidentA: Awaited<ReturnType<typeof createIncident>>;
  let archivedA: Awaited<ReturnType<typeof createIncident>>;
  let incidentB: Awaited<ReturnType<typeof createIncident>>;

  beforeAll(async () => {
    test = await createTestApp();
    tenantA = await createTenant(test.database);
    tenantB = await createTenant(test.database);
    // Keys sort: a_builder < b_viewer, so the first request picks the builder.
    builder = await createPosition(test.database, tenantA.id, {
      key: "a_builder",
      studioView: true,
      studioEdit: true,
      studioPublish: true,
      studioEditCode: true,
    });
    viewer = await createPosition(test.database, tenantA.id, {
      key: "b_viewer",
      studioView: true,
    });
    unassigned = await createPosition(test.database, tenantA.id, { key: "c_unassigned" });
    foreignPosition = await createPosition(test.database, tenantB.id, { key: "a_foreign" });
    incidentA = await createIncident(test.database, tenantA.id, { key: "drill_a" });
    archivedA = await createIncident(test.database, tenantA.id, {
      key: "old_a",
      status: "archived",
    });
    incidentB = await createIncident(test.database, tenantB.id, { key: "drill_b" });
  });

  afterAll(async () => {
    await test.close();
  });

  async function loginBuilder() {
    const login = await createLoginUser(test, tenantA.id, {
      displayName: "Builder",
      positionIds: [builder.id, viewer.id],
    });
    return { ...login, cookie: await signIn(test, login) };
  }

  async function auditRows(userId: string) {
    return withSystemTransaction(test.database.db, (tx) =>
      tx.select().from(sessionEvents).where(eq(sessionEvents.userId, userId)),
    );
  }

  it("session.get returns null for an anonymous caller and mutations return 401 unauthenticated", async () => {
    const get = await trpcQuery(test, "session.get");
    expect(get.status).toBe(200);
    expect(get.data).toBeNull();

    const mutation = await trpcMutation(test, "session.selectPosition", {
      positionId: builder.id,
    });
    expect(mutation.status).toBe(401);
    expect(mutation.apiCode).toBe("unauthenticated");

    const invalidCookie = await trpcMutation(
      test,
      "session.selectIncident",
      { incidentId: null },
      { cookie: "argus.session_token=not-a-real-token" },
    );
    expect(invalidCookie.status).toBe(401);
  });

  it("returns a snapshot with the first assigned position and its studio permissions", async () => {
    const login = await loginBuilder();
    const result = await trpcQuery(test, "session.get", { cookie: login.cookie });
    expect(result.status).toBe(200);
    const snapshot = snapshotOf(result.data);
    expect(snapshot.user.id).toBe(login.userId);
    expect(snapshot.tenant.id).toBe(tenantA.id);
    expect(snapshot.position.id).toBe(builder.id);
    expect(snapshot.availablePositions.map((position) => position.key)).toEqual([
      "a_builder",
      "b_viewer",
    ]);
    expect(snapshot.activeIncident).toBeNull();
    expect(snapshot.studio).toEqual({
      viewStudio: true,
      editDefinitions: true,
      publishDefinitions: true,
      editCode: true,
    });
    // No session-snapshot field may expose credentials.
    expect(JSON.stringify(result.data)).not.toMatch(/password|token/i);
  });

  it("ignores spoofed tenant and position headers and rejects tenant fields in bodies", async () => {
    const login = await loginBuilder();
    const spoofed = await trpcQuery(test, "session.get", {
      cookie: login.cookie,
      headers: {
        "x-tenant-id": tenantB.id,
        "x-position-id": foreignPosition.id,
        "x-user-id": crypto.randomUUID(),
      },
    });
    const snapshot = snapshotOf(spoofed.data);
    expect(snapshot.tenant.id).toBe(tenantA.id);
    expect(snapshot.position.id).toBe(builder.id);

    const body = await trpcMutation(
      test,
      "session.selectIncident",
      { incidentId: incidentA.id, tenantId: tenantB.id },
      { cookie: login.cookie },
    );
    expect(body.status).toBe(400);
    expect(body.apiCode).toBe("validation-failed");
    expect(await auditRows(login.userId)).toHaveLength(0);
  });

  it("selectPosition to an unassigned or another tenant's position is not-found", async () => {
    const login = await loginBuilder();
    for (const positionId of [unassigned.id, foreignPosition.id, crypto.randomUUID()]) {
      const result = await trpcMutation(
        test,
        "session.selectPosition",
        { positionId },
        { cookie: login.cookie },
      );
      expect(result.status).toBe(404);
      expect(result.apiCode).toBe("not-found");
    }
    expect(await auditRows(login.userId)).toHaveLength(0);
  });

  it("selectPosition to an assigned position updates the snapshot and writes exactly one audit row", async () => {
    const login = await loginBuilder();
    await trpcQuery(test, "session.get", { cookie: login.cookie });

    const result = await trpcMutation(
      test,
      "session.selectPosition",
      { positionId: viewer.id },
      { cookie: login.cookie },
    );
    expect(result.status).toBe(200);
    const snapshot = snapshotOf(result.data);
    expect(snapshot.position.id).toBe(viewer.id);
    expect(snapshot.studio).toEqual({
      viewStudio: true,
      editDefinitions: false,
      publishDefinitions: false,
      editCode: false,
    });

    const persisted = snapshotOf(
      (await trpcQuery(test, "session.get", { cookie: login.cookie })).data,
    );
    expect(persisted.position.id).toBe(viewer.id);

    const rows = await auditRows(login.userId);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.operation).toBe("select-position");
    expect(row?.tenantId).toBe(tenantA.id);
    expect(row?.userId).toBe(login.userId);
    expect(row?.positionId).toBe(viewer.id);
    expect(row?.previous).toEqual({ positionId: builder.id });
    expect(row?.next).toEqual({ positionId: viewer.id });
    expect(row?.requestId).toMatch(/^[0-9a-f-]{36}$/);

    // Reselecting the same position is a no-op without a second audit row.
    const again = await trpcMutation(
      test,
      "session.selectPosition",
      { positionId: viewer.id },
      { cookie: login.cookie },
    );
    expect(again.status).toBe(200);
    expect(await auditRows(login.userId)).toHaveLength(1);
  });

  it("selectIncident validates tenant and archive state, audits changes and clears with null", async () => {
    const login = await loginBuilder();
    for (const incidentId of [incidentB.id, archivedA.id, crypto.randomUUID()]) {
      const result = await trpcMutation(
        test,
        "session.selectIncident",
        { incidentId },
        { cookie: login.cookie },
      );
      expect(result.status).toBe(404);
      expect(result.apiCode).toBe("not-found");
    }
    expect(await auditRows(login.userId)).toHaveLength(0);

    const selected = await trpcMutation(
      test,
      "session.selectIncident",
      { incidentId: incidentA.id },
      { cookie: login.cookie },
    );
    expect(selected.status).toBe(200);
    expect(snapshotOf(selected.data).activeIncident?.id).toBe(incidentA.id);
    expect(
      snapshotOf((await trpcQuery(test, "session.get", { cookie: login.cookie })).data)
        .activeIncident?.id,
    ).toBe(incidentA.id);

    const cleared = await trpcMutation(
      test,
      "session.selectIncident",
      { incidentId: null },
      { cookie: login.cookie },
    );
    expect(snapshotOf(cleared.data).activeIncident).toBeNull();

    const rows = await auditRows(login.userId);
    expect(rows.map((row) => row.operation)).toEqual(["select-incident", "select-incident"]);
  });

  it("drops a stored incident that was archived after selection", async () => {
    const login = await loginBuilder();
    const incident = await createIncident(test.database, tenantA.id, { key: "soon_archived" });
    await trpcMutation(
      test,
      "session.selectIncident",
      { incidentId: incident.id },
      { cookie: login.cookie },
    );
    const { incidents } = await import("../src/persistence/system-schema.js");
    await withSystemTransaction(test.database.db, (tx) =>
      tx.update(incidents).set({ status: "archived" }).where(eq(incidents.id, incident.id)),
    );
    const snapshot = snapshotOf(
      (await trpcQuery(test, "session.get", { cookie: login.cookie })).data,
    );
    expect(snapshot.activeIncident).toBeNull();
  });

  it("does not offer an expired assignment and falls back when the stored position is no longer assigned", async () => {
    const login = await createLoginUser(test, tenantA.id, {
      positionIds: [viewer.id],
    });
    // Expired assignment to the builder position (valid_from earlier, valid_to in the past).
    const { assignPosition } = await import("./helpers/index.js");
    await assignPosition(test.database, {
      tenantId: tenantA.id,
      userId: login.userId,
      positionId: builder.id,
      validFrom: new Date(Date.now() - 120_000),
      validTo: new Date(Date.now() - 60_000),
    });
    const cookie = await signIn(test, login);
    const snapshot = snapshotOf((await trpcQuery(test, "session.get", { cookie })).data);
    expect(snapshot.availablePositions.map((position) => position.key)).toEqual(["b_viewer"]);
    expect(snapshot.position.id).toBe(viewer.id);

    const denied = await trpcMutation(
      test,
      "session.selectPosition",
      { positionId: builder.id },
      { cookie },
    );
    expect(denied.apiCode).toBe("not-found");

    // Force a stale stored position and confirm the fallback.
    await withSystemTransaction(test.database.db, (tx) =>
      tx
        .update(sessionContexts)
        .set({ positionId: unassigned.id })
        .where(eq(sessionContexts.userId, login.userId)),
    );
    const fallback = snapshotOf((await trpcQuery(test, "session.get", { cookie })).data);
    expect(fallback.position.id).toBe(viewer.id);
  });

  it("denies a user with no currently valid position assignment", async () => {
    const login = await createLoginUser(test, tenantA.id, { positionIds: [] });
    const cookie = await signIn(test, login);
    const result = await trpcQuery(test, "session.get", { cookie });
    expect(result.status).toBe(403);
    expect(result.apiCode).toBe("forbidden");
  });

  it("treats a disabled user as unauthenticated even with a previously valid session", async () => {
    const login = await loginBuilder();
    expect(
      snapshotOf((await trpcQuery(test, "session.get", { cookie: login.cookie })).data).user.id,
    ).toBe(login.userId);
    await setUserStatus(test, login.userId, "disabled");

    expect((await trpcQuery(test, "session.get", { cookie: login.cookie })).data).toBeNull();
    const mutation = await trpcMutation(
      test,
      "session.selectPosition",
      { positionId: viewer.id },
      { cookie: login.cookie },
    );
    expect(mutation.status).toBe(401);
    expect(mutation.apiCode).toBe("unauthenticated");
  });
});
