-- Hand-written migration (drizzle-kit generate --custom): roles, grants, forced row-level security,
-- append-only audit triggers and the narrow SECURITY DEFINER identity lookup.
-- Rollback/recovery: see migrations/README.md (0001). Forward-only; do not edit once applied.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'argus_app') THEN
    CREATE ROLE argus_app NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'argus_identity') THEN
    CREATE ROLE argus_identity NOLOGIN NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA meta TO argus_app, argus_identity;
--> statement-breakpoint

GRANT USAGE ON SCHEMA audit TO argus_app;
--> statement-breakpoint

-- argus_app gets no privileges on schema auth (Better Auth runs on its own connection).
REVOKE ALL ON SCHEMA auth FROM argus_app;
--> statement-breakpoint

GRANT SELECT ON meta.tenants TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.users TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.positions TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.user_positions TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.incidents TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.session_contexts TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.studio_definitions TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.studio_definition_versions TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.idempotency_keys TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON meta.api_keys TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT ON audit.record_changes TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT ON audit.definition_changes TO argus_app;
--> statement-breakpoint

GRANT SELECT, INSERT ON audit.session_events TO argus_app;
--> statement-breakpoint

ALTER TABLE meta.tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.tenants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.tenants FOR SELECT TO argus_app
  USING (id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.users FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.positions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.positions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.positions FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.user_positions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.user_positions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.user_positions FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.incidents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.incidents FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.incidents FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.session_contexts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.session_contexts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.session_contexts FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.studio_definitions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.studio_definitions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.studio_definitions FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.studio_definition_versions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.studio_definition_versions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.studio_definition_versions FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.idempotency_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.idempotency_keys FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.idempotency_keys FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE meta.api_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE meta.api_keys FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON meta.api_keys FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE audit.record_changes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE audit.record_changes FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON audit.record_changes FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE audit.definition_changes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE audit.definition_changes FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON audit.definition_changes FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE audit.session_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE audit.session_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY tenant_isolation ON audit.session_events FOR ALL TO argus_app
  USING (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(pg_catalog.current_setting('argus.tenant_id', true), '')::uuid);
--> statement-breakpoint

CREATE FUNCTION audit.reject_mutation() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'audit rows are append-only (% on %.%)', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END
$$;
--> statement-breakpoint

CREATE TRIGGER record_changes_append_only BEFORE UPDATE OR DELETE ON audit.record_changes
  FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation();
--> statement-breakpoint

CREATE TRIGGER record_changes_no_truncate BEFORE TRUNCATE ON audit.record_changes
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation();
--> statement-breakpoint

CREATE TRIGGER definition_changes_append_only BEFORE UPDATE OR DELETE ON audit.definition_changes
  FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation();
--> statement-breakpoint

CREATE TRIGGER definition_changes_no_truncate BEFORE TRUNCATE ON audit.definition_changes
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation();
--> statement-breakpoint

CREATE TRIGGER session_events_append_only BEFORE UPDATE OR DELETE ON audit.session_events
  FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation();
--> statement-breakpoint

CREATE TRIGGER session_events_no_truncate BEFORE TRUNCATE ON audit.session_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation();
--> statement-breakpoint

-- Identity resolution: the only pre-tenant read. Not an RLS bypass: the function is owned by argus_identity,
-- which sees meta.users only through its own narrow SELECT policy.
GRANT SELECT ON meta.users TO argus_identity;
--> statement-breakpoint

CREATE POLICY identity_resolution ON meta.users FOR SELECT TO argus_identity USING (true);
--> statement-breakpoint

CREATE FUNCTION meta.resolve_identity(p_auth_user_id text)
RETURNS TABLE (tenant_id uuid, user_id uuid, status text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, meta
AS $$
  SELECT u.tenant_id, u.id, u.status
  FROM meta.users AS u
  WHERE u.auth_user_id = p_auth_user_id
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT pg_catalog.pg_has_role(CURRENT_USER, 'argus_identity', 'MEMBER') THEN
    EXECUTE 'GRANT argus_identity TO ' || pg_catalog.quote_ident(CURRENT_USER);
  END IF;
END
$$;
--> statement-breakpoint

GRANT CREATE ON SCHEMA meta TO argus_identity;
--> statement-breakpoint

ALTER FUNCTION meta.resolve_identity(text) OWNER TO argus_identity;
--> statement-breakpoint

REVOKE CREATE ON SCHEMA meta FROM argus_identity;
--> statement-breakpoint

REVOKE ALL ON FUNCTION meta.resolve_identity(text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION meta.resolve_identity(text) TO argus_app;
