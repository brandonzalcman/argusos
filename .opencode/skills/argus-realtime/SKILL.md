---

name: argus-realtime
description: Patterns for ArgusOS real-time data — live queries via the sync engine, NATS JetStream events, presence, conflict handling and connection status. Load for any feature that shows or changes live data.
---

# Real-time data

Targets: commit → screen p95 < 250 ms; alert → device < 2 s; reconnect catch-up < 3 s with no missed changes.

## Which pipe

| Need                                                        | Use                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Show table/board/dashboard data                             | Live query via `useLiveQuery` (`@argus/sdk`, backed by ElectricSQL)           |
| React to a row change on the server (workflow, integration) | NATS subject `argus.<tenant>.<incident>.rows.<table>` from the change service |
| Alerts, workflow steps, external feeds                      | NATS JetStream streams `ALERTS`, `WORKFLOWS`, `FEEDS`                         |
| Presence, typing, "Sam is editing"                          | WebSocket gateway `apps/realtime`, ephemeral, not persisted                   |

Never poll in app code. The only polling is the built-in 5 s fallback when sync is down.

## Client rules

- Writes are optimistic; send `version`. On conflict the server returns per-field conflicts; show the conflict banner with both values. Never silently overwrite.
- New rows in a list appear behind a "N new" pill; do not shift rows under the cursor.
- Changed cells flash briefly (use `useChangeHighlight`).
- Every screen shows the global `ConnectionStatus` (live / reconnecting / offline + last update time).
- Offline writes go to the local queue and replay on reconnect.

## Server rules

- Permissions are applied to every subscription: a user never receives a row or field they cannot read with a normal query.
- NATS subjects are tenant- and incident-scoped; services get scoped credentials.
- Consumers are durable and idempotent (dedupe on event id). Ordering is by WAL LSN.
- Each change carries `committedAt`; the client reports render time to OpenTelemetry (`argus.realtime.latency`).

## Done when

Tests cover: update visible to a second client, permission-filtered update not delivered, reconnect replays missed changes, per-field conflict surfaced.
