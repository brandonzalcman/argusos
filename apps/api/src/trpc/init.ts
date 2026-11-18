import type { OperationContext } from "@argus/schema";
import { initTRPC } from "@trpc/server";
import type { Database } from "../db/client.js";
import { apiError, formatApiError } from "../errors.js";
import type { RequestContext } from "../http/request-context.js";

/** Long-lived dependencies injected by the composition root. */
export interface ApiDependencies {
  readonly database: Database;
}

/** Per-request tRPC context. `context` is null for anonymous requests. */
export interface TrpcContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly context: RequestContext | null;
  readonly deps: ApiDependencies;
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter: ({ error, shape, ctx }) => formatApiError({ error, shape, ctx }),
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/** Requires an authenticated RequestContext; the handler sees it as non-null. */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.context === null) {
    throw apiError("unauthenticated", "Authentication is required.");
  }
  return next({ ctx: { ...ctx, context: ctx.context } });
});

/** Operation context plus the request correlation id (audit trail); `OperationContext` itself has none. */
export type CallerContext = OperationContext & { readonly correlationId: string };

/** Operation context extended with the correlation id taken from the verified request context. */
export function callerContextFrom(context: RequestContext): CallerContext {
  return { ...operationContextFrom(context), correlationId: context.correlationId };
}

/** Builds the immutable per-operation security context from the verified request context. */
export function operationContextFrom(context: RequestContext): OperationContext {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    positionId: context.positionId,
    incidentId: context.activeIncidentId,
    requestId: context.requestId,
    authenticatedAt: context.authenticatedAt.toISOString(),
  };
}
