# @argus/realtime

Authenticated WebSocket gateway contracts for scoped events, presence, soft editing locks, alert fan-out, and recovery. All connection and protocol behavior is currently a throwing stub; this package does not connect to NATS or accept sockets.

## Implementation order

1. Validate configuration and implement the versioned wire protocol with strict payload/size/rate validation.
2. Authenticate the HTTP upgrade and every access-token refresh. Bind the connection to server-verified tenant, user, position, incident, session, and expiry claims; reauthorize after position or incident changes.
3. Issue least-privilege NATS credentials and subscribe only to canonical per-tenant/per-incident subjects. Perform authorization again before fan-out because NATS subject isolation is not field-level security.
4. Implement lifecycle cleanup, heartbeat timeouts, idempotent subscriptions, presence TTLs, and non-blocking soft editing locks. Never let a stale lock prevent incident work.
5. Implement alert delivery/acknowledgement and durable reconnect backfill from monotonic cursors. Re-run RLS/FLS authorization during replay; revoked users must not receive historical payloads.
6. Add five-second polling fallback, explicit stale/offline status, and OpenTelemetry commit-to-visible and alert latency measurements. Then run reconnect, revocation, duplicate-event, 2,000-connection, and gateway/NATS failure tests.

Row changes remain sourced from PostgreSQL/ElectricSQL. This gateway handles event traffic and must not become an alternate unauthenticated query API.

The Dockerfile is a build scaffold only. It has not been built or run.
