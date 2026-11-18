import { type BoardDataPort, createBoardDataPortStub } from "@argus/blocks";

/**
 * TEST ONLY. The real data port is still a TODO(implementation) stub; tests use that stub so
 * no fixture rows can be mistaken for operational data. Do not import from production code.
 */
export function createBoardDataPortStubForTests(): BoardDataPort {
  return createBoardDataPortStub();
}
