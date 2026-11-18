import { describe, it } from "vitest";

describe("PostgreSQL 18 integration", () => {
  it.todo("starts the disposable PostGIS image and verifies PostgreSQL major version 18");
  it.todo(
    "installs PostGIS and pg_trgm and executes representative geography and similarity queries",
  );
  it.todo(
    "supports logical replication without granting the application runtime replication privileges",
  );
  it.todo("stops and removes containers and volumes even when setup or assertions fail");
});
