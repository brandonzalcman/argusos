-- ArgusOS local development bootstrap, not an application migration.
-- Extensions are installed by the local administrator; production installation
-- and upgrades must be reviewed and applied through the deployment migration path.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
