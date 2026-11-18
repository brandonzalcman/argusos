import type { AnyTRPCRouter } from "@trpc/server";
import type { ApiServices } from "../services/services.js";

/** Public server router type; concrete procedure inference replaces this placeholder during implementation. */
export type AppRouter = AnyTRPCRouter;

/**
 * TODO(implementation): merge all authenticated domain routers into the application tRPC router.
 * Input: the shared domain services and RequestContext middleware configured by the composition root.
 * Output: the AppRouter consumed by Fastify's tRPC adapter and typed web clients.
 * Errors: throws at composition time for duplicate routes or missing security middleware.
 * Depends on: all domain router factories and common validation/error/audit middleware.
 * Security: no domain procedure may be public unless explicitly marked and reviewed.
 */
export function createAppRouter(_services: ApiServices): AppRouter {
  throw new Error("TODO(implementation): createAppRouter");
}
