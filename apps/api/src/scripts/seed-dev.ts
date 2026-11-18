import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { and, eq } from "drizzle-orm";
import { createBetterAuth } from "../auth/better-auth.js";
import {
  type ApiConfig,
  parseApiEnvironment,
  resolveDatabaseUrl,
  resolveSecretRef,
} from "../config/env.js";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { withSystemTransaction } from "../db/transaction.js";
import {
  authUser,
  incidents,
  positions,
  tenants,
  userPositions,
  users,
} from "../persistence/system-schema.js";

/**
 * Explicit, fictional development seed. NEVER runs implicitly. Refuses unless the configured
 * environment is `development` AND `ARGUS_ALLOW_DEV_SEED=true`, and requires
 * `ARGUS_DEV_SEED_PASSWORD` (>= 12 characters; never logged and not stored anywhere but as a
 * Better Auth password hash). Idempotent: re-running does not duplicate rows.
 *
 * Accounts are created server-side through a process-local Better Auth instance with sign-up
 * enabled (`allowSignUp`); the served API instance keeps public sign-up disabled.
 *
 * Studio definitions are intentionally NOT seeded here (owned by the studio slice).
 * PGlite is single-process: stop the dev server before seeding the same `pglite:<dir>`.
 */

export const SEED_TENANT = {
  slug: "fictional_county",
  name: "Fictional County (dev seed)",
} as const;

interface SeedPosition {
  readonly key: string;
  readonly name: string;
  readonly studioView: boolean;
  readonly studioEdit: boolean;
  readonly studioPublish: boolean;
  readonly studioEditCode: boolean;
}

const SEED_POSITIONS: readonly SeedPosition[] = [
  {
    key: "studio_builder",
    name: "Studio Builder (fictional)",
    studioView: true,
    studioEdit: true,
    studioPublish: true,
    studioEditCode: true,
  },
  {
    key: "studio_viewer",
    name: "Studio Viewer (fictional)",
    studioView: true,
    studioEdit: false,
    studioPublish: false,
    studioEditCode: false,
  },
  {
    key: "field_responder",
    name: "Field Responder (fictional)",
    studioView: false,
    studioEdit: false,
    studioPublish: false,
    studioEditCode: false,
  },
];

export const SEED_USERS: readonly {
  readonly displayName: string;
  readonly email: string;
  readonly positionKeys: readonly string[];
}[] = [
  {
    displayName: "Dev Builder",
    email: "builder@example.invalid",
    positionKeys: ["studio_builder", "studio_viewer"],
  },
  {
    displayName: "Dev Viewer",
    email: "viewer@example.invalid",
    positionKeys: ["studio_viewer"],
  },
  {
    displayName: "Dev Responder",
    email: "responder@example.invalid",
    positionKeys: ["field_responder"],
  },
];

const SEED_INCIDENT = {
  key: "drill_alpha",
  name: "Exercise ALPHA (fictional)",
  kind: "exercise",
  status: "active",
} as const;

export interface DevSeedOptions {
  /** Use an already-open (migrated) database instead of opening DATABASE_URL. */
  readonly database?: DatabaseHandle;
  readonly log?: (message: string) => void;
}

/** Throws a redacted error unless every safety condition for seeding holds. */
function assertSeedAllowed(
  config: ApiConfig,
  environment: Readonly<Record<string, string | undefined>>,
): string {
  if (config.environment !== "development") {
    throw new Error("Dev seed refused: NODE_ENV must be development.");
  }
  if (environment.ARGUS_ALLOW_DEV_SEED !== "true") {
    throw new Error("Dev seed refused: set ARGUS_ALLOW_DEV_SEED=true to allow it.");
  }
  const password = environment.ARGUS_DEV_SEED_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error(
      "Dev seed refused: ARGUS_DEV_SEED_PASSWORD must be set (at least 12 characters).",
    );
  }
  return password;
}

export async function runDevSeed(
  environment: Readonly<Record<string, string | undefined>>,
  options: DevSeedOptions = {},
): Promise<void> {
  const log = options.log ?? ((message: string) => console.log(message));
  const config = parseApiEnvironment(environment);
  const password = assertSeedAllowed(config, environment);

  const database =
    options.database ?? (await createDatabase(resolveDatabaseUrl(config, environment)));
  try {
    if (options.database === undefined && database.driver === "pglite") {
      await runMigrations(database);
    }
    const db = database.db;
    const auth = createBetterAuth({
      database: db,
      secret: resolveSecretRef(config.betterAuthSecretRef, environment),
      baseURL: config.betterAuthUrl,
      trustedOrigins: [...config.webOrigins, config.betterAuthUrl],
      allowSignUp: true,
    });

    const { tenantId, positionIds, created } = await withSystemTransaction(db, async (tx) => {
      let created = 0;
      let [tenant] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, SEED_TENANT.slug));
      if (tenant === undefined) {
        [tenant] = await tx.insert(tenants).values(SEED_TENANT).returning({ id: tenants.id });
        created += 1;
      }
      if (tenant === undefined) throw new Error("Dev seed failed: tenant was not created.");

      const positionIds = new Map<string, string>();
      for (const position of SEED_POSITIONS) {
        let [row] = await tx
          .select({ id: positions.id })
          .from(positions)
          .where(and(eq(positions.tenantId, tenant.id), eq(positions.key, position.key)));
        if (row === undefined) {
          [row] = await tx
            .insert(positions)
            .values({ tenantId: tenant.id, ...position })
            .returning({ id: positions.id });
          created += 1;
        }
        if (row === undefined) throw new Error("Dev seed failed: position was not created.");
        positionIds.set(position.key, row.id);
      }

      const [incident] = await tx
        .select({ id: incidents.id })
        .from(incidents)
        .where(and(eq(incidents.tenantId, tenant.id), eq(incidents.key, SEED_INCIDENT.key)));
      if (incident === undefined) {
        await tx.insert(incidents).values({ tenantId: tenant.id, ...SEED_INCIDENT });
        created += 1;
      }
      return { tenantId: tenant.id, positionIds, created };
    });

    for (const seedUser of SEED_USERS) {
      // Better Auth account (server-side only), reused when it already exists.
      let [account] = await db
        .select({ id: authUser.id })
        .from(authUser)
        .where(eq(authUser.email, seedUser.email));
      if (account === undefined) {
        const result = await auth.api.signUpEmail({
          body: { email: seedUser.email, password, name: seedUser.displayName },
        });
        account = { id: result.user.id };
      }
      const authUserId = account.id;

      await withSystemTransaction(db, async (tx) => {
        let [user] = await tx
          .select({ id: users.id, authUserId: users.authUserId })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.email, seedUser.email)));
        if (user === undefined) {
          [user] = await tx
            .insert(users)
            .values({
              tenantId,
              authUserId,
              displayName: seedUser.displayName,
              email: seedUser.email,
              status: "active",
            })
            .returning({ id: users.id, authUserId: users.authUserId });
        } else if (user.authUserId === null) {
          await tx.update(users).set({ authUserId }).where(eq(users.id, user.id));
        }
        if (user === undefined) throw new Error("Dev seed failed: user was not created.");
        for (const key of seedUser.positionKeys) {
          const positionId = positionIds.get(key);
          if (positionId === undefined) continue;
          await tx
            .insert(userPositions)
            .values({ tenantId, userId: user.id, positionId })
            .onConflictDoNothing();
        }
      });
    }

    log(
      `dev seed complete: tenant ${SEED_TENANT.slug}, ${SEED_POSITIONS.length} positions, ` +
        `${SEED_USERS.length} users (${created} new catalog rows this run)`,
    );
    log(
      `sign in as: ${SEED_USERS.map((user) => user.email).join(", ")} (password: ARGUS_DEV_SEED_PASSWORD)`,
    );
  } finally {
    if (options.database === undefined) await database.close();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  try {
    await runDevSeed(process.env);
  } catch (error) {
    // Message only: never print the cause chain, environment or password.
    console.error(error instanceof Error ? error.message : "Dev seed failed.");
    process.exitCode = 1;
  }
}
