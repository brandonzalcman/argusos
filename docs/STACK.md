# Stack and dependency policy

The authoritative direct-dependency pins live in the `catalog` section of [`pnpm-workspace.yaml`](../pnpm-workspace.yaml). Workspace manifests must use `catalog:` and workspace packages must use `workspace:*`; do not introduce a second version source.

## Selected options

| Area                | Selection                     | Scaffold implication                                                                           |
| ------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| API                 | Fastify + tRPC + REST/OpenAPI | tRPC is first-party; REST is the stable integration boundary.                                  |
| Row synchronization | ElectricSQL                   | Postgres remains authoritative. Sync shapes require explicit authorization design.             |
| Non-row events      | NATS JetStream                | Durable consumers need idempotency and ordered change publication.                             |
| Auth                | Better Auth, OIDC first       | SAML/large-agency identity can be added through a port without changing app context contracts. |
| System migrations   | Drizzle                       | Only stable system tables; user tables go through the DDL engine.                              |
| Jobs                | Graphile Worker               | No Redis dependency; worker concurrency and retries must be explicit.                          |
| Local deployment    | Docker Compose                | Development topology, not a production security baseline.                                      |
| Kubernetes          | Helm                          | External PostgreSQL/NATS/S3/Electric lifecycle remains an operator concern.                    |
| Expression language | CEL                           | One typed language across boards, formulas, permissions and workflows.                         |

## Version policy

- Node.js is restricted to the 26 LTS line and pnpm to the pinned 12.x release.
- TypeScript intentionally remains on the latest 5.x release because the approved plan specifies TypeScript 5.x, even if a newer major exists. Upgrade the plan and test the whole workspace before changing majors.
- Runtime and tool dependencies use exact versions in the pnpm catalog. The lockfile pins transitive dependencies.
- Expo packages must be upgraded as a compatible SDK set, not independently to whatever npm labels latest.
- React, React DOM, their type packages, tRPC client/server, Storybook packages, OpenTelemetry SDK/exporter packages, Tailwind packages and Testcontainers packages should be upgraded in aligned groups.
- PostgreSQL, ElectricSQL, NATS, Martin and Grafana image tags/digests need the same review discipline as npm dependencies.
- Renovate proposes changes; CI and real integration checks must pass before they are accepted.

## Air-gapped deployment requirement

Production images must contain their runtime dependencies and generated assets. An air-gapped installation cannot depend on npm, a hosted CDN, externally hosted fonts, public map tiles or a hosted identity provider at runtime. Operators may provide internal OIDC, S3, map, SMTP and observability endpoints through configuration.

## Native/mobile compatibility

The mobile workspace is an Expo SDK shell. Before implementation, generate/verify the SDK's bundled native dependency versions and lock them together. Do not add native folders to source control unless the project deliberately switches to a bare/prebuild workflow; generated `ios/` and `android/` directories are currently ignored.
