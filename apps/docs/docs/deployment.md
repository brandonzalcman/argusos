---
title: Deployment
---

:::danger No production deployment is provided
This scaffold documentation does not claim working Docker Compose, Helm, databases, object storage, NATS, gateways, push providers or backup recovery.
:::

## Target topology

A future small-site deployment combines web/API/realtime/worker images with PostgreSQL 18 + PostGIS, ElectricSQL, NATS JetStream and S3-compatible object storage. Martin/MapLibre support map delivery when map features arrive. Kubernetes packaging uses Helm; a smaller Docker Compose path supports self-hosted sites.

Deployment sources belong in `deploy/`; the local Compose scaffold is `deploy/compose/docker-compose.yaml`. Application ownership is listed in [Architecture](./architecture.md). No environment here should be assumed to be internet-connected: all images, dependencies, fonts and map assets need an air-gappable distribution plan.

## Required controls

- Separate tenant/database credentials and least-privilege service identities.
- TLS, secret injection, key rotation and no secrets in images/source.
- Database migrations with backup/restore and forward-recovery procedures.
- Durable NATS/storage volumes and explicit retention policies.
- Backup restoration drills, not merely backup jobs.
- Health/readiness behavior that does not expose incident or tenant details.
- OpenTelemetry with sensitive-field redaction and bounded cardinality.
- Signed artifacts and provenance for offline distribution.

## Delivery order

1. Build one local Postgres-backed API vertical slice and verify migrations/RLS/audit.
2. Add reproducible application images and local Compose wiring.
3. Add sync/NATS/object storage only with integration and failure tests.
4. Add Helm values, resource limits, network policies and upgrade tests.
5. Add observability, backup restoration and air-gapped installation verification.
6. Complete a security review and incident operational runbooks before production claims.

Do not use the placeholder docs hostname (`docs.argusos.invalid`) or mobile `.scaffold` application identifiers as production settings. Deployment examples should use explicit placeholders until maintainers supply verified configuration.
