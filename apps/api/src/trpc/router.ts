import { createSessionRouter } from "../session/router.js";
import { createSessionService } from "../session/service.js";
import { createStudioRouter } from "../studio/router.js";
import { type ApiDependencies, router } from "./init.js";

/**
 * Build the application tRPC router: `session` (public `get`, authenticated mutations) and `studio`
 * (every procedure authenticated and permission-checked in the studio service).
 */
export function createAppRouter(dependencies: ApiDependencies) {
  const { database } = dependencies;
  return router({
    session: createSessionRouter(createSessionService({ database })),
    studio: createStudioRouter({ database }),
  });
}

/** Public server router type consumed by typed web clients (see `router-types.ts`). */
export type AppRouter = ReturnType<typeof createAppRouter>;
