import type { FastifyInstance } from "fastify";
import type { ApiServices } from "../services/services.js";

/**
 * TODO(implementation): register versioned REST handlers and health endpoints over shared domain services.
 * Input: Fastify instance with authentication/error middleware and the composed ApiServices.
 * Output: REST routes matching REST_V1_ROUTES and HEALTH_ROUTES exactly.
 * Errors: maps domain failures to stable problem+json responses without leaking row existence or secrets.
 * Depends on: Zod schemas, request context, scoped API keys, rate limits, and OpenAPI contracts.
 * Security: handlers cannot query repositories directly; tenant/incident/FLS/version/audit rules remain in services.
 */
export function registerRestRoutes(_server: FastifyInstance, _services: ApiServices): void {
  throw new Error("TODO(implementation): registerRestRoutes");
}
