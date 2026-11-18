import { defineConfig } from "drizzle-kit";

/** Generates SQL only; applying migrations is done by `src/db/migrate.ts`. No database URL is needed. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/persistence/system-schema.ts",
  out: "./migrations",
  schemaFilter: ["meta", "audit", "auth"],
  strict: true,
  verbose: true,
});
