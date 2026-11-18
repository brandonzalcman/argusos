# @argus/api

Fastify composition root and public contracts for the internal tRPC API and versioned integration REST API. This package is a scaffold: every behavior entry point throws `TODO(implementation)` and no server, query, identity provider, or storage connection is active.

## Implementation order

1. Validate environment configuration and compose Fastify, OpenTelemetry, Better Auth, OIDC, and PostgreSQL without exposing secrets.
2. Implement request authentication and derive an immutable tenant, user, position, incident, request, and audit context. Never accept tenant or position identity from an unverified request body.
3. Implement Drizzle repositories and reviewed migrations for system tables. Set database session claims inside each transaction and enforce **PostgreSQL row-level security (RLS) on every tenant-owned system and user table**. RLS is a mandatory second boundary, not an optional optimization.
4. Enforce position RBAC plus incident/jurisdiction ABAC in services. Apply **field-level security (FLS) in every read, write, export, realtime event, and generated table endpoint**; filter rejected fields rather than relying on clients to hide them.
5. Add tRPC domain routers and REST handlers against the same services. Generate OpenAPI 3.1 from the REST contracts; never maintain a divergent access path.
6. Add optimistic version checks, append-only audit events, scoped API keys, file quarantine, public-form review, and readiness checks. Test cross-tenant, cross-incident, exercise/live, and deleted-position denial cases.

System records use Drizzle. Physical user tables must be migrated only through `@argus/ddl-engine`; this app must not concatenate identifiers or values into SQL.

## API boundaries

- tRPC is for the authenticated ArgusOS application.
- `/api/v1/*` is the stable integration surface and accepts only explicitly scoped API keys or sessions.
- Better Auth owns its authentication endpoints and callback state. OIDC discovery, PKCE, nonce, and token validation are adapter responsibilities.
- Public submissions always enter review and cannot directly mutate live incident records.

The Dockerfile is a build scaffold only. It has not been built or run.
