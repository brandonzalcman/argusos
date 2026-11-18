---

name: argus-testing
description: ArgusOS test conventions — Vitest unit and integration tests with Testcontainers Postgres, Playwright E2E, fixtures and what every test suite must cover. Load when writing or running tests.
---

# Testing

## Where

| Type                   | Location                           | Runner                                                   |
| ---------------------- | ---------------------------------- | -------------------------------------------------------- |
| Unit                   | next to source: `foo.test.ts`      | `pnpm --filter <pkg> test` (Vitest)                      |
| Integration (DB, NATS) | `<pkg>/test/integration/*.test.ts` | Vitest + Testcontainers (Postgres 18 + PostGIS, NATS)    |
| E2E                    | `apps/web/e2e/*.spec.ts`           | `pnpm test:e2e` (Playwright)                             |
| Fixtures               | `<pkg>/test/fixtures/`             | Shared builders, e.g. `makeIncident()`, `makePosition()` |

## Every suite covers

1. Happy path from the doc comment.
2. Validation failure (bad input rejected by Zod).
3. Permission denial (wrong position or incident → no data / error).
4. Audit: a write produces the expected `audit.record_changes` row.
5. Real time (where relevant): a second client sees the change; a user without access does not.

## Scaffold phase

While code is still stubbed, tests are `it.todo` / `describe.todo` describing intended behaviour. Never add meaningless passing assertions. Replace a todo with a real test only when its code is implemented.

## Rules

- No network calls to real services; use Testcontainers or in-memory fakes.
- No sleeps. Wait on events or use Vitest fake timers.
- Tests are independent and can run in parallel; each creates its own tenant/schema.
- E2E: use role-based locators (`getByRole`), seed through the API, test at desktop and phone viewport.
- Report real output. A test you did not run is not passing.
