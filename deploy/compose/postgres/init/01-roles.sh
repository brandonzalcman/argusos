#!/bin/sh
# LOCAL DEVELOPMENT ONLY. Role passwords are read from the container environment
# (set from deploy/compose/.env via ${VAR:?} interpolation in docker-compose.yaml);
# none are stored in this repository. Production uses an external secret manager
# and separately rotated credentials for every role.
#
# The runtime role deliberately has no BYPASSRLS. Every tenant-scoped table must
# enable and FORCE row-level security; application transactions must SET LOCAL
# tenant, user, position, and incident claims before accessing protected rows.
#
# Runs once, on a new data volume only. TODO(verify): exercise with Docker.
set -eu

psql -v ON_ERROR_STOP=1 \
  -v migrator_pw="$ARGUS_MIGRATOR_PASSWORD" \
  -v runtime_pw="$ARGUS_RUNTIME_PASSWORD" \
  -v electric_pw="$ARGUS_ELECTRIC_PASSWORD" \
  -v reporting_pw="$ARGUS_REPORTING_PASSWORD" \
  -v martin_pw="$ARGUS_MARTIN_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
-- psql interpolates :'var' (quoted literal) and \gexec runs the generated DDL,
-- because variables are not expanded inside DO $$ bodies.
SELECT format('CREATE ROLE argus_migrator LOGIN PASSWORD %L', :'migrator_pw')
  WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'argus_migrator') \gexec
SELECT format('CREATE ROLE argus LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'runtime_pw')
  WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'argus') \gexec
SELECT format('CREATE ROLE argus_electric LOGIN NOSUPERUSER REPLICATION PASSWORD %L', :'electric_pw')
  WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'argus_electric') \gexec
SELECT format('CREATE ROLE argus_reporting LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'reporting_pw')
  WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'argus_reporting') \gexec
SELECT format('CREATE ROLE argus_martin LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'martin_pw')
  WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'argus_martin') \gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE argus FROM PUBLIC;
GRANT CONNECT ON DATABASE argus TO argus_migrator, argus, argus_electric,
  argus_reporting, argus_martin;
GRANT CREATE ON DATABASE argus TO argus_migrator, argus_electric;

CREATE SCHEMA IF NOT EXISTS meta AUTHORIZATION argus_migrator;
CREATE SCHEMA IF NOT EXISTS data AUTHORIZATION argus_migrator;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION argus_migrator;

GRANT USAGE ON SCHEMA meta, data, audit TO argus;
GRANT USAGE ON SCHEMA meta, data TO argus_electric;
GRANT USAGE ON SCHEMA meta, data TO argus_reporting;
GRANT USAGE ON SCHEMA data TO argus_martin;

-- These defaults apply only to objects subsequently created by argus_migrator.
-- They do not replace explicit grants, RLS policies, column privileges, or the
-- audit trigger design implemented by application migrations.
ALTER DEFAULT PRIVILEGES FOR ROLE argus_migrator IN SCHEMA meta
  GRANT SELECT ON TABLES TO argus, argus_electric, argus_reporting;
ALTER DEFAULT PRIVILEGES FOR ROLE argus_migrator IN SCHEMA data
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO argus;
ALTER DEFAULT PRIVILEGES FOR ROLE argus_migrator IN SCHEMA data
  GRANT SELECT ON TABLES TO argus_electric, argus_reporting, argus_martin;
ALTER DEFAULT PRIVILEGES FOR ROLE argus_migrator IN SCHEMA data
  GRANT USAGE, SELECT ON SEQUENCES TO argus;
ALTER DEFAULT PRIVILEGES FOR ROLE argus_migrator IN SCHEMA audit
  GRANT SELECT ON TABLES TO argus, argus_reporting;

-- TODO(implementation): migrations must create an explicitly authorized Electric
-- publication and grant only replicated tables. Do not grant blanket replication
-- access to audit secrets or unauthorized tenant/incident rows.
-- TODO(implementation): migrations must expose explicitly authorized PostGIS
-- tables/views to Martin with tenant-aware predicates before enabling publication.
SQL
