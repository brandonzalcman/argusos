import {
  selectIncidentInputSchema,
  selectPositionInputSchema,
  sessionSnapshotSchema,
} from "@argus/schema";
import { authedProcedure, publicProcedure, router } from "../trpc/init.js";
import type { SessionService } from "./service.js";

/**
 * The `session` tRPC router. `get` is public and resolves to null for anonymous callers (matching
 * `SessionPort.get`); the mutations require an authenticated context. Inputs and outputs are the
 * shared `@argus/schema` session contracts.
 */
export function createSessionRouter(service: SessionService) {
  return router({
    get: publicProcedure
      .output(sessionSnapshotSchema.nullable())
      .query(({ ctx }) => (ctx.context === null ? null : service.get(ctx.context))),
    selectPosition: authedProcedure
      .input(selectPositionInputSchema)
      .output(sessionSnapshotSchema)
      .mutation(({ ctx, input }) => service.selectPosition(ctx.context, input)),
    selectIncident: authedProcedure
      .input(selectIncidentInputSchema)
      .output(sessionSnapshotSchema)
      .mutation(({ ctx, input }) => service.selectIncident(ctx.context, input)),
  });
}
