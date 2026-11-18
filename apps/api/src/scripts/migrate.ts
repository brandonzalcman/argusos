import { parseApiEnvironment, resolveDatabaseUrl } from "../config/env.js";
import { createDatabase } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";

/** `pnpm --filter @argus/api db:migrate` — applies pending migrations to DATABASE_URL. */
const config = parseApiEnvironment(process.env);
const database = await createDatabase(resolveDatabaseUrl(config, process.env));
try {
  await runMigrations(database);
  console.log("migrations applied");
} finally {
  await database.close();
}
