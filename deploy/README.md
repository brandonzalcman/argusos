# Deployment scaffold

This directory contains **declarative development and production-oriented deployment scaffolds**, not a verified ArgusOS release. No application container images, health endpoints, migrations, external-service connectivity, backup/restore, or production installation have been executed or verified. Docker, Helm and k6 were not available when these files were last edited, so everything below was checked by reading and by static YAML/JSON-schema validation only.

## Implementation order

1. Validate and pin the development images and healthcheck utilities in an isolated Docker environment.
2. Implement application environment parsing, `/health/live`, `/health/ready`, graceful shutdown in the owning app packages and build the images below.
3. Implement migrations, `FORCE ROW LEVEL SECURITY`, tenant/incident claims, append-only audit, explicitly authorized Electric publications, and Martin tile functions.
4. Configure production external dependencies, TLS, secrets, backups, resource requests, ingress, and observability through the organization's deployment process.
5. Run the integration, reconnect, authorization, 2,000-connection load, chaos, rolling-upgrade, and restore tests in `tests/` before calling any deployment production-ready.

## One-command local development

```sh
cp deploy/compose/.env.example deploy/compose/.env   # once; Windows: Copy-Item
docker compose -f deploy/compose/docker-compose.yaml up -d --wait   # dependencies
pnpm install --frozen-lockfile                                        # once
pnpm dev                                                              # applications on the host
```

Compose automatically loads `deploy/compose/.env` (the project directory is the folder of the Compose file), so no `--env-file` flag is needed. `.env` is git-ignored. Alternatively run `docker compose up -d --wait` from inside `deploy/compose/`.

## Docker Compose: local development dependencies

The Compose project provides PostgreSQL 18 with PostGIS and `pg_trgm`, ElectricSQL, NATS JetStream (with per-user permissions), Garage (S3-compatible storage), and Martin. An `observability` profile adds OpenTelemetry Collector, Prometheus, Grafana, Loki, and Tempo. An `apps` profile builds and runs the web, API, realtime and worker images; it is **not** part of the default stack, and the application entry points behind it are still stubs.

All published ports bind to `127.0.0.1`. Named volumes retain local data, healthchecks gate dependent startup, and the `argus-development` network isolates project traffic.

### Credentials: `${VAR:?}` interpolation

No password is stored in `docker-compose.yaml`, the PostgreSQL bootstrap, the Martin config or `nats.conf`. Every credential is read from `deploy/compose/.env` through `${VAR:?message}`, so a missing variable aborts `docker compose` instead of silently falling back. `deploy/compose/.env.example` provides public, local-only placeholder values for every variable. The root `.env.example` repeats the Postgres and S3 values inside `DATABASE_URL`, `MIGRATION_DATABASE_URL` and `S3_*`; keep both in sync if you change one. The CI guard (below) rejects literal passwords reappearing in the Compose file.

PostgreSQL roles are created by `postgres/init/01-roles.sh` from `ARGUS_*_PASSWORD` environment variables. Initialization runs only on a new data volume; changing it, or changing a password, does not alter an existing volume (recreate it or `ALTER ROLE`).

### Start and inspect

```sh
cp deploy/compose/.env.example deploy/compose/.env
docker compose -f deploy/compose/docker-compose.yaml up -d --wait
docker compose -f deploy/compose/docker-compose.yaml ps
docker compose -f deploy/compose/docker-compose.yaml logs -f postgres electric nats martin
```

Optional profiles:

```sh
docker compose -f deploy/compose/docker-compose.yaml --profile observability up -d --wait
docker compose -f deploy/compose/docker-compose.yaml --profile apps up -d --build   # scaffold images
```

Stop processes without deleting persistent data (add `--profile ...` for profiles you started):

```sh
docker compose -f deploy/compose/docker-compose.yaml down
```

Do not use `down --volumes` unless intentionally erasing the local database, JetStream, object storage, and telemetry.

Validate interpolation and dependency configuration without starting containers:

```sh
docker compose --env-file deploy/compose/.env.example -f deploy/compose/docker-compose.yaml config --quiet
```

### Local endpoints and deliberately public credentials

These values are for an isolated developer machine only. They are not examples suitable for production.

| Dependency               | Endpoint                                                                                | Local-only credential                                                      |
| ------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PostgreSQL administrator | `127.0.0.1:5432/argus`                                                                  | `argus_admin` / `POSTGRES_ADMIN_PASSWORD`                                  |
| Application migrations   | `postgresql://argus_migrator:<ARGUS_MIGRATOR_PASSWORD>@127.0.0.1:5432/argus`            | privileged migration role; never use for runtime queries                   |
| Application runtime      | `postgresql://argus:<ARGUS_RUNTIME_PASSWORD>@127.0.0.1:5432/argus`                      | `NOBYPASSRLS`; requires `SET LOCAL` tenant/user/position/incident claims   |
| ElectricSQL              | `http://127.0.0.1:3003`                                                                 | replication role `argus_electric`; shape authorization is not implemented  |
| NATS JetStream           | `nats://argus_api:<NATS_API_PASSWORD>@127.0.0.1:4222` (also `argus_realtime`, `argus_worker`) | per-user subject permissions in `nats/nats.conf`                           |
| NATS monitoring          | `http://127.0.0.1:8222`                                                                 | local only; do not expose publicly                                         |
| Garage S3                | `http://127.0.0.1:9000`                                                                 | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`, bucket `S3_BUCKET`, path-style |
| Martin                   | `http://127.0.0.1:3004`                                                                 | auto-publication disabled; no tenant-aware tile functions yet              |
| Grafana                  | `http://127.0.0.1:3300`                                                                 | `argus_admin` / `GRAFANA_ADMIN_PASSWORD`                                   |
| OTLP gRPC / HTTP         | `127.0.0.1:4317` / `127.0.0.1:4318`                                                     | no TLS or authentication; local profile only                               |

NATS authentication is enabled locally: `api` may publish `argus.>` and manage JetStream, `realtime` may only subscribe to `argus.>` and publish presence, `worker` may consume and publish `argus.>`. The subject layout (`argus.<tenant>.<incident>.<kind>`) is a placeholder `TODO(decision)` until `apps/realtime` fixes it. **Helm equivalent:** the chart does not install NATS; the NATS operator/cluster must enforce the same permission sets with TLS, one credential per workload delivered in that workload's own Secret as `NATS_URL` (or NKey/JWT credentials), and dynamic per-tenant/incident credentials once the API mints them. The root `.env.example` `NATS_URL` already uses the `argus_api` user; keep its password equal to `NATS_API_PASSWORD`.

PostgreSQL bootstrap separates migrator, runtime, replication, reporting, and tile-serving roles. This separation is only a starting contract: runtime RLS policies, secure audit triggers, publication membership, column grants, and tenant-aware tile functions remain implementation work. In particular, replication or tile credentials must never be treated as proof that a connected client is authorized to receive a row.

Observability uses short-lived local storage and no public authentication beyond Grafana. Production must define telemetry redaction, authenticated encrypted ingestion, retention, resource limits, and alert rules. Incident records, tokens, personal data, and sensitive field values must not be emitted as telemetry attributes.

## Container images

`apps/{api,realtime,worker,web}/Dockerfile` are multi-stage and use the repository root as build context:

```sh
docker build -f apps/api/Dockerfile -t argus-api .
```

- Build stage: `pnpm install --frozen-lockfile --filter @argus/<app>...`, build, then `pnpm --filter @argus/<app> deploy --prod --legacy /out` so the runtime stage receives only production dependencies and built workspace packages (no sources, dev dependencies or other apps).
- Runtime stage: slim Node image (web: `nginxinc/nginx-unprivileged` serving `apps/web/dist` through `deploy/docker/web/nginx.conf` on port 3000, with a `/healthz` endpoint), non-root user, read-only-root-friendly (writable paths only in `/tmp`), and a `HEALTHCHECK`.
- **Base-image digests:** Dockerfiles take `ARG NODE_IMAGE` (and `NGINX_IMAGE` for web) with a tag as the local default. Release builds must pass an immutable digest, e.g. `--build-arg NODE_IMAGE=node:26.13.1-alpine3.23@sha256:<digest>`. The digests are placeholders until a release pipeline resolves them (`TODO(verify)` in each file); Renovate should bump tag and digest together.
- Unverified assumptions flagged `TODO(verify)`: the `--legacy` flag for pnpm 12, inclusion of `dist/` by `pnpm deploy` despite `.gitignore`, the nginx tag, and that `nginx -t` accepts the config. None of these images has been built.

## Helm: application workloads only

`helm/argus` templates web, API, realtime, and worker Deployments with separate ServiceAccounts, disabled token automount, non-root/read-only/seccomp-restricted security contexts (compatible with the Pod Security `restricted` profile; label the namespace `pod-security.kubernetes.io/enforce=restricted`), startup/liveness/readiness probes, default resource requests and limits, NetworkPolicies, optional HPAs, PDBs, Services, and optional Ingress. The worker has a health port but no Service.

The chart **does not provision or validate** PostgreSQL/PostGIS, ElectricSQL, NATS JetStream, S3, Martin, OIDC, DNS, TLS certificates, observability, or migrations. Empty external endpoints and Secret names intentionally fail template rendering. Placeholder image tag `0.0.0` is not a published image.

### Validate

```sh
helm lint deploy/helm/argus --values deploy/helm/argus/values.example.yaml
helm template argus deploy/helm/argus --namespace argus-system --values deploy/helm/argus/values.example.yaml
helm lint deploy/helm/argus --values deploy/helm/argus/values.production.example.yaml
bash .github/scripts/check-deploy-guards.sh
```

`values.example.yaml` uses `.invalid` endpoints and is only a lint/template fixture. `values.schema.json` rejects misspelled or incorrectly typed values and requires `resources.requests`/`limits` for every workload.

### Production values and image digests

Set `production: true` (see `values.production.example.yaml`). Rendering then fails unless **every** workload has `image.digest: sha256:<64 hex>`; a `latest` tag is rejected in all modes. The all-zero digests in the example are schema-valid placeholders that reference no image; the release pipeline must supply the real ones. Default resources are unmeasured starting points (`TODO(verify)`): replace them from load-test data and enable HPAs only with a working metrics pipeline.

### Per-workload Secrets

Each server workload receives **only its own** pre-created Secret (`secrets.api|realtime|worker.existingSecret`); the web Deployment mounts none. Create them out of band with an approved secret manager. Suggested keys:

| Secret     | Keys                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`      | `DATABASE_URL` (`NOBYPASSRLS` role), `NATS_URL` (api user), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `ELECTRIC_SECRET` (server-side shape proxy), `BETTER_AUTH_SECRET`, `OIDC_CLIENT_SECRET` |
| `realtime` | `DATABASE_URL` (a separate role if possible), `NATS_URL` (realtime user: subscribe + presence only), `BETTER_AUTH_SECRET` (session verification)           |
| `worker`   | `DATABASE_URL` (separate role), `NATS_URL` (worker user), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                                                       |

Migration credentials (`MIGRATION_DATABASE_URL`) belong to a controlled migration job, never these Secrets. Rotate each independently. `kubectl create secret generic ... --from-literal` leaks through shell history and is acceptable only for a throwaway experiment. The CI guard rejects literal credentials in `deploy/helm`.

### NetworkPolicy

With `networkPolicy.enabled` (default) the chart renders a default-deny (ingress and egress) policy for all release pods, then explicit allows: DNS egress, ingress-controller → web/api/realtime (`networkPolicy.ingressFrom`, required when ingress is enabled), realtime ↔ api (`TODO(verify)` call direction), and egress to PostgreSQL, NATS, object storage, Electric (api only) and OTLP **only when** the matching `networkPolicy.egress.<dependency>.to` peer list is set (CIDR `ipBlock`s or selectors). An empty list renders no rule and the dependency stays unreachable, because an egress rule without `to` would allow every destination. Requires a CNI that enforces NetworkPolicy; no policy has been applied or tested.

### Install only after prerequisites are real

```sh
kubectl create namespace argus-system --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install argus deploy/helm/argus --namespace argus-system --values <reviewed-values.yaml>
```

Ingress is disabled by default. When enabled, configure TLS, API prefix rewriting if required, and WebSocket upgrade/timeouts for `/realtime`. ElectricSQL and Martin endpoints are external URLs supplied to applications; the chart does not create routes for them. A PDB with `minAvailable: 1` blocks voluntary eviction of a one-replica worker; size replicas and disruption policy deliberately.

## CI guards

`.github/scripts/check-deploy-guards.sh` runs in the `infrastructure` job and fails on `:latest` image tags (Compose, Helm, Dockerfiles), literal credentials in `deploy/helm` and `docker-compose.yaml`, and any GitHub Action not pinned to a full commit SHA. All Actions in `.github/` are pinned by SHA with a version comment (resolved from the upstream repositories' tags with `git ls-remote`). The workflow also renders the production values template and asserts that `production=true` without digests is refused. These are static text checks, not a secret scanner. Helm is pinned to v3.19.5 in CI (`azure/setup-helm` `version`).

## Unverified and unresolved

- Image tags, healthcheck binaries/endpoints, ElectricSQL configuration, Martin `DATABASE_URL` handling, NATS permission behaviour, `01-roles.sh` (psql `\gexec` with variables) and observability config compatibility need a real Compose smoke test (`TODO(verify)`).
- No Docker image builds, Kubernetes admission, NetworkPolicy enforcement, HPA behavior, PDB drain, ingress WebSocket test, external dependency connection, migration, backup, or restore has been run. The Helm templates, including the new NetworkPolicy and Secret-per-workload logic, have **not** been rendered because Helm is not installed; only the values files were validated against `values.schema.json` with a JSON-schema validator.
- Migration jobs, secret rotation, database high availability, JetStream clustering, S3 lifecycle/versioning, and disaster-recovery runbooks remain to be designed with the application owners.
