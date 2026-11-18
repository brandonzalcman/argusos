import { type BoardDataPort, createBoardDataPortStub } from "@argus/blocks";
import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import { createExpressionValidationStub, type ExpressionValidationPort } from "./expression.js";
import { type BoardScope, type BoardsRepositoryPort, createBoardsRepositoryStub } from "./model.js";

/**
 * Everything the board pages need from the outside world.
 *
 * `scope` is the server-established tenant/incident/position context. It is null until the app
 * has an authenticated session adapter, in which case pages render an explicit blocked state
 * instead of loading anything.
 */
export interface BoardsEnvironment {
  readonly scope: BoardScope | null;
  readonly repository: BoardsRepositoryPort;
  readonly data: BoardDataPort;
  readonly expressions: ExpressionValidationPort;
}

/**
 * TODO(implementation): supply the authenticated scope and real adapters at the app root.
 * Input: none. Output: a disconnected environment (no scope, throwing ports).
 * Errors: ports throw TODO(implementation); pages surface them as error states.
 * Depends on: auth/session adapter, apps/api board endpoints, Electric-backed BoardDataPort.
 */
export function createDisconnectedBoardsEnvironment(): BoardsEnvironment {
  return {
    scope: null,
    repository: createBoardsRepositoryStub(),
    data: createBoardDataPortStub(),
    expressions: createExpressionValidationStub(),
  };
}

const defaultEnvironment = createDisconnectedBoardsEnvironment();
const BoardsEnvironmentContext = createContext<BoardsEnvironment>(defaultEnvironment);

export function BoardsEnvironmentProvider({
  environment,
  children,
}: {
  readonly environment: BoardsEnvironment;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <BoardsEnvironmentContext.Provider value={environment}>
      {children}
    </BoardsEnvironmentContext.Provider>
  );
}

export function useBoardsEnvironment(): BoardsEnvironment {
  return useContext(BoardsEnvironmentContext);
}
