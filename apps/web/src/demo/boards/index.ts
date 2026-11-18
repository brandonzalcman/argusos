import type { BoardsEnvironment } from "../../features/boards/environment.js";
import { DEMO_ACTOR, DEMO_SCOPE, demoId, minutesAgo } from "../scenario.js";
import { createDemoBoardDataPort } from "./data.js";
import { createDemoExpressionValidation } from "./expression.js";
import { createDemoBoardsRepository } from "./repository.js";

/** Demo-mode BoardsEnvironment: signed-in Incident Commander, in-memory boards, fictional rows. */
export function createDemoBoardsEnvironment(): BoardsEnvironment {
  return {
    scope: {
      tenantId: DEMO_SCOPE.tenantId,
      incidentId: DEMO_SCOPE.incidentId,
      userId: DEMO_ACTOR.userId,
      positionId: DEMO_ACTOR.positionId,
      requestId: demoId(),
      authenticatedAt: minutesAgo(90),
    },
    repository: createDemoBoardsRepository(),
    data: createDemoBoardDataPort(),
    expressions: createDemoExpressionValidation(),
  };
}
