import { PostgreSqlContainer } from "@testcontainers/postgresql";

export const POSTGRES_18_POSTGIS_IMAGE = "postgis/postgis:18-3.6";

/**
 * Create a disposable PostgreSQL 18 container configured for PostGIS, pg_trgm,
 * and logical replication without starting it or contacting Docker.
 * Input: none; image and local-only credentials are fixed test fixtures.
 * Output: a Testcontainers builder for suites to start and always stop in teardown.
 * Errors: image/runtime failures occur at start; callers own lifecycle and cleanup.
 * Depends on: a Docker-compatible Testcontainers runtime and the pinned PostGIS image.
 * Security: credentials are local and ephemeral; suites must exercise a separate
 * NOBYPASSRLS runtime role and must never reuse production data or credentials.
 */
export function createPostgres18Container(): PostgreSqlContainer {
  return new PostgreSqlContainer(POSTGRES_18_POSTGIS_IMAGE)
    .withDatabase("argus_test")
    .withUsername("argus_test_admin")
    .withPassword("argus-test-container-only")
    .withCommand([
      "postgres",
      "-c",
      "wal_level=logical",
      "-c",
      "max_replication_slots=4",
      "-c",
      "max_wal_senders=8",
    ])
    .withStartupTimeout(120_000);
}
