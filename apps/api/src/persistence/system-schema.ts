import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * System catalog schema. Tables here are changed only through reviewed Drizzle migrations
 * (`apps/api/migrations`). Row-level security, grants, append-only audit triggers and the
 * SECURITY DEFINER identity functions live in the hand-written migration `0001_*` because
 * Drizzle does not model them. Every tenant-owned table below is covered there.
 */
export const metaSchema = pgSchema("meta");
export const auditSchema = pgSchema("audit");
export const authSchema = pgSchema("auth");

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => tz("created_at").notNull().defaultNow();
const updatedAt = () => tz("updated_at").notNull().defaultNow();
const version = () => integer("version").notNull().default(1);

/* ------------------------------------------------------------------------------------------ */
/* Better Auth (authentication only; tenancy and positions are ArgusOS-side mappings)          */
/* ------------------------------------------------------------------------------------------ */

export const authUser = authSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: tz("createdAt").notNull().defaultNow(),
  updatedAt: tz("updatedAt").notNull().defaultNow(),
});

export const authSession = authSchema.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: tz("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: tz("createdAt").notNull().defaultNow(),
    updatedAt: tz("updatedAt").notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (t) => [index("auth_session_user_id_idx").on(t.userId)],
);

export const authAccount = authSchema.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: tz("accessTokenExpiresAt"),
    refreshTokenExpiresAt: tz("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: tz("createdAt").notNull().defaultNow(),
    updatedAt: tz("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("auth_account_user_id_idx").on(t.userId)],
);

export const authVerification = authSchema.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: tz("expiresAt").notNull(),
    createdAt: tz("createdAt").notNull().defaultNow(),
    updatedAt: tz("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("auth_verification_identifier_idx").on(t.identifier)],
);

/** Schema map for Better Auth's Drizzle adapter (keys are Better Auth model names). */
export const authSchemaTables = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
} as const;

/* ------------------------------------------------------------------------------------------ */
/* meta: tenancy, identity, positions, incidents, session context                              */
/* ------------------------------------------------------------------------------------------ */

export const tenants = metaSchema.table("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").$type<"active" | "suspended" | "archived">().notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: version(),
});

export const users = metaSchema.table(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    authUserId: text("auth_user_id")
      .unique()
      .references(() => authUser.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    email: text("email"),
    status: text("status").$type<"invited" | "active" | "disabled">().notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: version(),
  },
  (t) => [
    unique("users_id_tenant_uq").on(t.id, t.tenantId),
    index("users_tenant_idx").on(t.tenantId),
  ],
);

export const positions = metaSchema.table(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    homepageBoardId: uuid("homepage_board_id"),
    isSystem: boolean("is_system").notNull().default(false),
    studioView: boolean("studio_view").notNull().default(false),
    studioEdit: boolean("studio_edit").notNull().default(false),
    studioPublish: boolean("studio_publish").notNull().default(false),
    studioEditCode: boolean("studio_edit_code").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: version(),
  },
  (t) => [
    unique("positions_tenant_key_uq").on(t.tenantId, t.key),
    unique("positions_id_tenant_uq").on(t.id, t.tenantId),
  ],
);

export const userPositions = metaSchema.table(
  "user_positions",
  {
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    positionId: uuid("position_id").notNull(),
    validFrom: tz("valid_from").notNull().defaultNow(),
    validTo: tz("valid_to"),
  },
  (t) => [
    primaryKey({ name: "user_positions_pk", columns: [t.userId, t.positionId] }),
    foreignKey({
      name: "user_positions_user_fk",
      columns: [t.userId, t.tenantId],
      foreignColumns: [users.id, users.tenantId],
    }),
    foreignKey({
      name: "user_positions_position_fk",
      columns: [t.positionId, t.tenantId],
      foreignColumns: [positions.id, positions.tenantId],
    }),
  ],
);

export const incidents = metaSchema.table(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    kind: text("kind").$type<"live" | "exercise">().notNull(),
    status: text("status")
      .$type<"planned" | "active" | "monitoring" | "closed" | "archived">()
      .notNull()
      .default("planned"),
    level: smallint("level"),
    operationalPeriod: text("operational_period"),
    activatedAt: tz("activated_at"),
    closedAt: tz("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: version(),
  },
  (t) => [
    unique("incidents_tenant_key_uq").on(t.tenantId, t.key),
    unique("incidents_id_tenant_uq").on(t.id, t.tenantId),
  ],
);

/** Server-side session context: which position/incident an authenticated session is acting in. */
export const sessionContexts = metaSchema.table(
  "session_contexts",
  {
    authSessionId: text("auth_session_id")
      .primaryKey()
      .references(() => authSession.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    positionId: uuid("position_id").notNull(),
    incidentId: uuid("incident_id"),
    updatedAt: updatedAt(),
    version: version(),
  },
  (t) => [
    foreignKey({
      name: "session_contexts_user_fk",
      columns: [t.userId, t.tenantId],
      foreignColumns: [users.id, users.tenantId],
    }),
    foreignKey({
      name: "session_contexts_position_fk",
      columns: [t.positionId, t.tenantId],
      foreignColumns: [positions.id, positions.tenantId],
    }),
    foreignKey({
      name: "session_contexts_incident_fk",
      columns: [t.incidentId, t.tenantId],
      foreignColumns: [incidents.id, incidents.tenantId],
    }),
  ],
);

/* ------------------------------------------------------------------------------------------ */
/* meta: studio definitions (boards, pages, components)                                        */
/* ------------------------------------------------------------------------------------------ */

export const studioDefinitions = metaSchema.table(
  "studio_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    kind: text("kind").$type<"board" | "page" | "component">().notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug"),
    draftVersion: integer("draft_version"),
    publishedVersion: integer("published_version"),
    latestVersion: integer("latest_version").notNull(),
    archivedAt: tz("archived_at"),
    createdAt: createdAt(),
    createdBy: uuid("created_by").notNull(),
    updatedAt: updatedAt(),
    updatedBy: uuid("updated_by").notNull(),
    rowVersion: integer("row_version").notNull().default(1),
  },
  (t) => [
    unique("studio_definitions_tenant_kind_key_uq").on(t.tenantId, t.kind, t.key),
    unique("studio_definitions_id_tenant_uq").on(t.id, t.tenantId),
    uniqueIndex("studio_definitions_page_slug_uq")
      .on(t.tenantId, t.slug)
      .where(sql`${t.kind} = 'page' and ${t.slug} is not null`),
    foreignKey({
      name: "studio_definitions_created_by_fk",
      columns: [t.createdBy, t.tenantId],
      foreignColumns: [users.id, users.tenantId],
    }),
    foreignKey({
      name: "studio_definitions_updated_by_fk",
      columns: [t.updatedBy, t.tenantId],
      foreignColumns: [users.id, users.tenantId],
    }),
    index("studio_definitions_tenant_kind_idx").on(t.tenantId, t.kind),
  ],
);

export const studioDefinitionVersions = metaSchema.table(
  "studio_definition_versions",
  {
    tenantId: uuid("tenant_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    version: integer("version").notNull(),
    lifecycle: text("lifecycle").$type<"draft" | "published" | "archived">().notNull(),
    document: jsonb("document").$type<unknown>().notNull(),
    changeSummary: text("change_summary"),
    createdAt: createdAt(),
    createdBy: uuid("created_by").notNull(),
    createdPositionId: uuid("created_position_id").notNull(),
    publishedAt: tz("published_at"),
    publishedBy: uuid("published_by"),
  },
  (t) => [
    primaryKey({ name: "studio_definition_versions_pk", columns: [t.definitionId, t.version] }),
    foreignKey({
      name: "studio_definition_versions_definition_fk",
      columns: [t.definitionId, t.tenantId],
      foreignColumns: [studioDefinitions.id, studioDefinitions.tenantId],
    }),
    foreignKey({
      name: "studio_definition_versions_created_by_fk",
      columns: [t.createdBy, t.tenantId],
      foreignColumns: [users.id, users.tenantId],
    }),
    foreignKey({
      name: "studio_definition_versions_position_fk",
      columns: [t.createdPositionId, t.tenantId],
      foreignColumns: [positions.id, positions.tenantId],
    }),
  ],
);

/** Replay protection for mutations: same key + same input hash returns the stored response. */
export const idempotencyKeys = metaSchema.table(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id").notNull(),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").$type<unknown>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("idempotency_keys_tenant_user_key_uq").on(t.tenantId, t.userId, t.key),
    foreignKey({
      name: "idempotency_keys_user_fk",
      columns: [t.userId, t.tenantId],
      foreignColumns: [users.id, users.tenantId],
    }),
  ],
);

/** Placeholder: API key storage lands with the REST slice; RLS and grants already cover it. */
export const apiKeys = metaSchema.table("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  secretHash: text("secret_hash").notNull(),
  scopes: jsonb("scopes").$type<readonly string[]>().notNull(),
  createdBy: uuid("created_by").notNull(),
  expiresAt: tz("expires_at").notNull(),
  revokedAt: tz("revoked_at"),
});

/* ------------------------------------------------------------------------------------------ */
/* audit: append-only                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** Placeholder: record-level audit is written by user-table triggers in the DDL-engine slice. */
export const recordChanges = auditSchema.table("record_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  incidentId: uuid("incident_id"),
  tableId: uuid("table_id").notNull(),
  recordId: uuid("record_id").notNull(),
  requestId: text("request_id").notNull(),
  actorUserId: uuid("actor_user_id").notNull(),
  actorPositionId: uuid("actor_position_id"),
  changedAt: tz("changed_at").notNull().defaultNow(),
  fieldDiff: jsonb("field_diff").$type<Readonly<Record<string, unknown>>>().notNull(),
});

/** Mirrors `auditDefinitionChangeSchema` in @argus/schema plus the request correlation id. */
export const definitionChanges = auditSchema.table(
  "definition_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    definitionKind: text("definition_kind").notNull(),
    definitionId: uuid("definition_id").notNull(),
    previousVersion: integer("previous_version"),
    version: integer("version").notNull(),
    operation: text("operation")
      .$type<"create-draft" | "update-draft" | "publish" | "restore" | "archive">()
      .notNull(),
    changeSummary: text("change_summary"),
    actorUserId: uuid("actor_user_id").notNull(),
    actorPositionId: uuid("actor_position_id").notNull(),
    requestId: text("request_id").notNull(),
    correlationId: text("correlation_id").notNull(),
    occurredAt: tz("occurred_at").notNull().defaultNow(),
  },
  (t) => [index("definition_changes_definition_idx").on(t.tenantId, t.definitionId, t.occurredAt)],
);

export const sessionEvents = auditSchema.table(
  "session_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id").notNull(),
    positionId: uuid("position_id").notNull(),
    operation: text("operation")
      .$type<"select-position" | "select-incident" | "sign-in">()
      .notNull(),
    previous: jsonb("previous").$type<unknown>(),
    next: jsonb("next").$type<unknown>(),
    requestId: text("request_id").notNull(),
    occurredAt: tz("occurred_at").notNull().defaultNow(),
  },
  (t) => [index("session_events_user_idx").on(t.tenantId, t.userId, t.occurredAt)],
);

/** Tables with a `tenant_id` column that must be covered by RLS (asserted in tests). */
export const tenantOwnedTableNames = [
  "meta.users",
  "meta.positions",
  "meta.user_positions",
  "meta.incidents",
  "meta.session_contexts",
  "meta.studio_definitions",
  "meta.studio_definition_versions",
  "meta.idempotency_keys",
  "meta.api_keys",
  "audit.record_changes",
  "audit.definition_changes",
  "audit.session_events",
] as const;
