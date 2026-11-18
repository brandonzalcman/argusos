# Deployment scaffold

This directory contains **declarative development and production-oriented deployment scaffolds**, not a verified ArgusOS release. No application container images, health endpoints, migrations, external-service connectivity, backup/restore, or production installation have been executed or verified.

## Implementation order

1. Validate and pin the development images and healthcheck utilities in an isolated Docker environment.
2. Implement application environment parsing, `/health/live`, `/health/ready`, graceful shutdown, and non-root container images in the owning app packages.
3. Implement migrations, `FORCE ROW LEVEL SECURITY`, tenant/incident claims, append-only audit, explicitly authorized Electric publications, and Martin tile functions.
4. Configure production external dependencies, TLS, secrets, backups, resource requests, ingress, and observability through the organization's deployment process.
5. Run the integration, reconnect, authorization, 2,000-connection load, chaos, rolling-upgrade, and restore tests in `tests/` before calling any deployment production-ready.

## Docker Compose: local development dependencies

The Compose project provides PostgreSQL 18 with PostGIS and `pg_trgm`, ElectricSQL, NATS JetStream, MinIO, and Martin. An `observability` profile adds OpenTelemetry Collector, Prometheus, Grafana, Loki, and Tempo. Applications are intentionally **not** Compose services yet because their container entry points do not exist.

All published ports bind to `127.0.0.1`. Named volumes retain local data, healthchecks gate dependent startup, and the `argus-development` network isolates project traffic. The initial MinIO bucket is private.

### Start and inspect

From the repository root:

```sh
cp deploy/compose/.env.example .env.development
docker compose --env-file .env.development -f deploy/compose/docker-compose.yaml up -d --wait
docker compose --env-file .env.development -f deploy/compose/docker-compose.yaml ps
docker compose --env-file .env.development -f deploy/compose/docker-compose.yaml logs -f postgres electric nats martin
```

With the optional observability profile:

```sh
docker compose --env-file .env.development -f deploy/compose/docker-compose.yaml --profile observability up -d --wait
```

Stop processes without deleting persistent data:

```sh
docker compose --env-file .env.development -f deploy/compose/docker-compose.yaml --profile observability down
```

Do not use `down --volumes` unless intentionally erasing the local database, JetStream, object storage, and telemetry. PostgreSQL initialization SQL runs only on a new database volume; changing `deploy/compose/postgres/init/` does not migrate an existing volume.

Validate interpolation and dependency configuration without starting containers:

```sh
docker compose --env-file deploy/compose/.env.example -f deploy/compose/docker-compose.yaml config --quiet
```

### Local endpoints and deliberately public credentials

These values are for an isolated developer machine only. They are not examples suitable for production.

| Dependency               | Endpoint                                                                                     | Local-only credential                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| PostgreSQL administrator | `127.0.0.1:5432/argus`                                                                       | `argus_admin` / value of `POSTGRES_ADMIN_PASSWORD`                                |
| Application migrations   | `postgresql://argus_migrator:argus-local-migrator-only@127.0.0.1:5432/argus?sslmode=disable` | privileged migration role; never use for runtime queries                          |
| Application runtime      | `postgresql://argus:argus@127.0.0.1:5432/argus?sslmode=disable`                              | `NOBYPASSRLS`; requires `SET LOCAL` tenant/user/position/incident claims          |
| ElectricSQL              | `http://127.0.0.1:3003`                                                                      | replication role `argus_electric`; shape authorization is not implemented         |
| NATS JetStream           | `nats://127.0.0.1:4222`                                                                      | no authentication on loopback only; tenant-scoped credentials are not implemented |
| NATS monitoring          | `http://127.0.0.1:8222`                                                                      | local only; do not expose publicly                                                |
| MinIO S3                 | `http://127.0.0.1:9000`                                                                      | values of `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`                             |
| MinIO console            | `http://127.0.0.1:9001`                                                                      | bucket `argus-local`, anonymous access disabled                                   |
| Martin                   | `http://127.0.0.1:3004`                                                                      | auto-publication disabled; no tenant-aware tile functions yet                     |
| Grafana                  | `http://127.0.0.1:3300`                                                                      | `argus_admin` / value of `GRAFANA_ADMIN_PASSWORD`                                 |
| OTLP gRPC / HTTP         | `127.0.0.1:4317` / `127.0.0.1:4318`                                                          | no TLS or authentication; local profile only                                      |

PostgreSQL bootstrap separates migrator, runtime, replication, reporting, and tile-serving roles. This separation is only a starting contract: runtime RLS policies, secure audit triggers, publication membership, column grants, and tenant-aware tile functions remain implementation work. In particular, replication or tile credentials must never be treated as proof that a connected client is authorized to receive a row.

Observability uses short-lived local storage and no public authentication beyond Grafana. Production must define telemetry redaction, authenticated encrypted ingestion, retention, resource limits, and alert rules. Incident records, tokens, personal data, and sensitive field values must not be emitted as telemetry attributes.

## Helm: application workloads only

`helm/argus` templates web, API, realtime, and worker Deployments with separate ServiceAccounts, disabled token automount by default, non-root/read-only security contexts, startup/liveness/readiness probes, optional HPAs, PDBs, Services, and optional Ingress. The worker has a health port but no Service. The web pod does not mount the runtime Secret.

The chart **does not provision or validate** PostgreSQL/PostGIS, ElectricSQL, NATS JetStream, S3/MinIO, Martin, OIDC, DNS, TLS certificates, observability, or migrations. Empty external endpoints and `secrets.existingSecret` intentionally fail template rendering. Placeholder image tag `0.0.0` is not a published image.

### Validate

```sh
helm lint deploy/helm/argus --values deploy/helm/argus/values.example.yaml
helm template argus deploy/helm/argus --namespace argus-system --values deploy/helm/argus/values.example.yaml
```

`values.example.yaml` uses `.invalid` endpoints and is only a lint/template fixture. `values.schema.json` rejects misspelled or incorrectly typed values. Copy production values into an approved deployment configuration outside the chart, prefer immutable image digests, set resource requests/limits from measurements, and enable HPAs only with a working metrics pipeline. Set `observability.otlpEndpoint` only for an externally managed OTLP/HTTP collector. A PDB with `minAvailable: 1` blocks voluntary eviction of a one-replica worker; size replicas and disruption policy deliberately.

### Runtime Secret contract

Create `argus-runtime` out of band using an approved secret manager. Server workloads import the whole Secret as environment variables; expected keys are:

- `DATABASE_URL`: privileged enough for intended runtime operations but using a `NOBYPASSRLS` role; migration credentials must be delivered separately to a controlled migration job.
- `NATS_URL`: includes scoped credentials and TLS settings, with per-tenant/incident subject permissions.
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: limited to the ArgusOS bucket and required object actions.
- `ELECTRIC_SECRET`: server-side sync secret; never expose it to the browser.
- `BETTER_AUTH_SECRET` and, when used, `OIDC_CLIENT_SECRET`: authentication secrets managed and rotated independently.

For a local Kubernetes experiment only, `kubectl create secret generic argus-runtime --from-literal=KEY=VALUE ...` can create the placeholder, but literal credentials leak through shell history and are not an approved production mechanism.

### Install only after prerequisites are real

```sh
kubectl create namespace argus-system --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install argus deploy/helm/argus --namespace argus-system --values <reviewed-values.yaml>
```

Ingress is disabled by default. When enabled, configure TLS, API prefix rewriting if required, and WebSocket upgrade/timeouts for `/realtime`. ElectricSQL and Martin endpoints are external URLs supplied to applications; the chart does not create routes for them.

## Unverified and unresolved

- Image tags, healthcheck binaries/endpoints, ElectricSQL configuration, Martin configuration, and observability config compatibility need a real Compose smoke test (`TODO(verify)` in the Compose file).
- No Docker image builds, Kubernetes admission, HPA behavior, PDB drain, ingress WebSocket test, external dependency connection, migration, backup, or restore has been run.
- Production network policies, Pod Security admission, migration jobs, secret rotation, database high availability, JetStream clustering, S3 lifecycle/versioning, and disaster-recovery runbooks remain to be designed with the application owners.
