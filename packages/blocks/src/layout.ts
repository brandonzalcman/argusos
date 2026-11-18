import type { BoardLayoutEnginePort } from "./layout-types.js";

function layoutNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): BoardLayoutEnginePort.${method}`);
}

/**
 * TODO(implementation): validate and resolve accessible 12-column responsive board layouts.
 * Input: versioned breakpoint placements and a viewport selected by the runtime/builder.
 * Output: a stub port; future validation reports bounds/collisions and resolution preserves order.
 * Errors: validate and resolve throw TODO(implementation); no layout algorithm is implied here.
 * Depends on: @argus/schema board definitions, builder collision rules, and keyboard drag controls.
 */
export function createBoardLayoutEngineStub(): BoardLayoutEnginePort {
  return {
    validate: () => layoutNotImplemented("validate"),
    resolve: () => layoutNotImplemented("resolve"),
  };
}
