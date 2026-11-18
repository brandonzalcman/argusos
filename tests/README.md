# Cross-project verification scaffold

These suites define intended verification contracts. They are **not passing product tests**: Playwright scenarios are explicitly skipped, Vitest scenarios are `it.todo`, and the k6 entry point throws `TODO(implementation)` before opening a connection.

## Prerequisites and implementation order

1. Install root workspace dependencies with the parent-owned pnpm setup. This scaffold adds no package manifest and requires no additional catalog dependencies.
2. Implement deterministic fixtures with two tenants, live/exercise incidents, users in distinct positions, sensitive fields, optimistic versions, and append-only audit records.
3. Implement authenticated API, ElectricSQL, and WebSocket protocols with commit IDs, WAL cursors, commit timestamps, reconnect cursors, and render acknowledgements.
4. Replace TODOs one vertical slice at a time, always cleaning up containers and guaranteeing that authorization assertions run with a `NOBYPASSRLS` role.
5. Add repeatable performance runs, chaos runs, and result archival before release. Never use production credentials or operational incident records.

## Typecheck all test contracts

```sh
pnpm exec tsc --noEmit --project tests/tsconfig.json
```

## Playwright

List tests without installing or launching a browser:

```sh
pnpm exec playwright test --config tests/e2e/playwright.config.ts --list
```

Run against an existing application:

```sh
pnpm exec playwright install chromium
ARGUS_E2E_BASE_URL=http://127.0.0.1:4173 pnpm test:e2e
```

On Windows PowerShell, set the URL with `$env:ARGUS_E2E_BASE_URL = "http://127.0.0.1:4173"` before `pnpm test:e2e`.

To request the future web workspace through Playwright's `webServer` integration:

```sh
ARGUS_E2E_START_WEB=1 ARGUS_E2E_BASE_URL=http://127.0.0.1:4173 pnpm test:e2e
```

That command requires an implemented `@argus/web` package and its development server. Tests currently skip even when no server is running; skipped tests provide no evidence of functionality.

Playwright requirements include:

- Commit-to-visible-render p95 below 250 ms and p99 below 1 second across subscribed screens.
- Full ordered catch-up within 3 seconds after network loss, with no missed changes.
- Visible live/reconnecting/offline state and 5-second polling fallback.
- Optimistic version handling, per-field conflict UX, and offline replay.
- API-equivalent tenant, incident, position, and field permissions on every stream, including revocation and incident switching.

## Testcontainers: PostgreSQL 18, RLS, and recovery

A Docker-compatible runtime is required. `support/postgres.ts` only constructs a disposable PostgreSQL 18/PostGIS container definition; no suite starts it yet.

```sh
docker info
pnpm test:integration
```

Integration requirements include PostgreSQL major-version and extension checks, logical replication, lifecycle cleanup, `FORCE RLS`, absent/malformed claim denial, tenant and incident isolation, live/exercise separation, sensitive-field privileges, optimistic locking, atomic audit/outbox behavior, and ordered recovery after realtime dependency termination.

Never validate RLS using a table owner, superuser, or `BYPASSRLS` connection. Apply tenant, user, position, and incident claims with `SET LOCAL` inside the same transaction as the operation under test. Electric publications and Martin tile functions must receive equivalent negative authorization tests.

## k6 realtime load and chaos contract

Validate syntax without executing load:

```sh
k6 inspect tests/performance/realtime.k6.js
```

The root command is intentionally reserved for the future implementation:

```sh
ARGUS_REALTIME_WS_URL=wss://test.example.invalid/realtime pnpm test:load
```

It currently fails with `TODO(implementation)` and must not be represented as a load-test result. The future harness needs short-lived synthetic credentials and explicit fixture identifiers in its environment; tokens, record payloads, and high-cardinality user/record tags must not be logged.

A valid run must:

- Sustain **2,000 concurrent authenticated WebSocket connections for at least 10 minutes**, then separately demonstrate 10,000+ across multiple gateways with gateway counts disclosed.
- Measure commit-to-visible latency at p95 <250 ms and p99 <1 second, alert delivery below 2 seconds, and complete reconnect catch-up below 3 seconds.
- Drop/reconnect at least 5% of connections each minute during write bursts; verify every committed change exactly once and in order using server commit IDs and cursors.
- Assert zero unauthorized events across tenants, incidents, positions, field privileges, live/exercise modes, and revoked sessions.
- Record CPU, memory, connection establishment failures, reconnect storms, PostgreSQL replication lag, and NATS JetStream consumer lag.
- Repeat while terminating gateways, ElectricSQL, and NATS processes. Reconnected sockets alone are not evidence of durability.

## Current verification status

The scaffold passed strict `tsc --noEmit --project tests/tsconfig.json`, Biome check/format, JavaScript syntax validation, and Playwright `--list` discovery of seven explicitly skipped scenarios. Vitest executed three suite files and reported **23 TODO tests**, not 23 passing tests. No browser, Docker container, database, Kubernetes resource, or k6 network run was executed.

Docker, Helm, and k6 CLIs were unavailable in the authoring environment, so Compose rendering, Helm lint/template, and `k6 inspect` remain unverified here and are defined as CI infrastructure checks. No dependencies were installed by this implementation work. CI performs static discovery/validation on normal pushes; Docker-backed integration and Playwright execution are manual workflow options until real application prerequisites exist.
