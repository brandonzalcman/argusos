import { integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Placeholder catalog shape only; reviewed migrations, constraints, indexes, RLS, and FLS are mandatory. */
export const metaSchema = pgSchema("meta");
export const auditSchema = pgSchema("audit");

export const tenants = metaSchema.table("tenants", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  version: integer("version").notNull(),
});

export const users = metaSchema.table("users", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  externalSubject: text("external_subject"),
  displayName: text("display_name").notNull(),
  disabledAt: timestamp("disabled_at", { withTimezone: true, mode: "date" }),
  version: integer("version").notNull(),
});

export const positions = metaSchema.table("positions", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  key: text("key").notNull(),
  displayName: text("display_name").notNull(),
  definition: jsonb("definition").$type<Readonly<Record<string, unknown>>>().notNull(),
  version: integer("version").notNull(),
});

export const userPositions = metaSchema.table("user_positions", {
  userId: uuid("user_id").notNull(),
  positionId: uuid("position_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
});

export const incidents = metaSchema.table("incidents", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").$type<"live" | "exercise">().notNull(),
  status: text("status").$type<"draft" | "active" | "archived">().notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  version: integer("version").notNull(),
});

export const definitionVersions = metaSchema.table("definition_versions", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  definitionKind: text("definition_kind").notNull(),
  definitionKey: text("definition_key").notNull(),
  revision: integer("revision").notNull(),
  state: text("state").$type<"draft" | "published" | "retired">().notNull(),
  definition: jsonb("definition").$type<Readonly<Record<string, unknown>>>().notNull(),
  createdBy: uuid("created_by").notNull(),
  createdPositionId: uuid("created_position_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const apiKeys = metaSchema.table("api_keys", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  secretHash: text("secret_hash").notNull(),
  scopes: jsonb("scopes").$type<readonly string[]>().notNull(),
  createdBy: uuid("created_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
});

export const recordChanges = auditSchema.table("record_changes", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  incidentId: uuid("incident_id"),
  tableId: uuid("table_id").notNull(),
  recordId: uuid("record_id").notNull(),
  requestId: text("request_id").notNull(),
  actorUserId: uuid("actor_user_id").notNull(),
  actorPositionId: uuid("actor_position_id"),
  changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull(),
  fieldDiff: jsonb("field_diff").$type<Readonly<Record<string, unknown>>>().notNull(),
});
