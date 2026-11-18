import type { FastifyInstance } from "fastify";
import type { BetterAuthPort, OidcProviderPort } from "./auth/ports.js";
import type { ApiConfig } from "./config/env.js";
import type { ApiServices } from "./services/services.js";

export interface ApiComposition {
  readonly config: ApiConfig;
  readonly betterAuth: BetterAuthPort;
  readonly oidc: OidcProviderPort | null;
  readonly services: ApiServices;
}

/**
 * TODO(implementation): compose Fastify with security middleware, tRPC, REST, OpenAPI, and graceful shutdown.
 * Input: validated configuration, identity ports, and shared domain services.
 * Output: a configured Fastify instance that is ready to listen but has no ambient global state.
 * Errors: throws redacted startup errors and closes partially initialized dependencies.
 * Depends on: Fastify, @trpc/server, Better Auth/OIDC, Drizzle repositories, and telemetry.
 * Security: registers authentication before protected routes, limits payloads, sets secure headers, and
 * preserves tenant/incident/RLS/FLS/audit semantics across both transports.
 */
export function createApiServer(_dependencies: ApiComposition): Promise<FastifyInstance> {
  throw new Error("TODO(implementation): createApiServer");
}

/**
 * TODO(implementation): validate environment, build all ports, start the API listener, and handle signals.
 * Input: raw process environment values supplied by main or a test harness.
 * Output: resolves only after graceful shutdown; does not return an unauthenticated global server.
 * Errors: throws safe startup errors and attempts dependency cleanup before process termination.
 * Depends on: parseApiEnvironment, identity adapters, repositories/services, and createApiServer.
 * Security: secret references are resolved only inside infrastructure adapters and never written to logs.
 */
export function startApi(
  _environment: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  throw new Error("TODO(implementation): startApi");
}
