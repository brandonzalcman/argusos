export * from "./block-configs.js";
export type {
  BoardDataPort,
  BoardDataRequest,
  BoardDataResult,
  BoardMutationRequest,
  BoardMutationResult,
} from "./data-port.js";
export { createBoardDataPortStub } from "./data-port.js";
export { createBoardLayoutEngineStub } from "./layout.js";
export * from "./layout-types.js";
export * from "./modules/index.js";
export { coreBlockModules } from "./modules/index.js";
export { type BlockRegistry, createBlockRegistry } from "./registry.js";
export { createBoardRendererStub, renderBoard } from "./renderer.js";
export { createBlockStub } from "./stub.js";
export type {
  AnyBlockModule,
  BlockCategory,
  BlockModule,
  BlockRenderContext,
  BlockRendererProps,
  BlockSecurityScope,
  BoardRendererPort,
  BoardRendererProps,
} from "./types.js";

import { coreBlockModules } from "./modules/index.js";
import { createBlockRegistry } from "./registry.js";

/** Core module discovery registry; lookup does not execute a block or fetch data. */
export const coreBlockRegistry = createBlockRegistry(coreBlockModules);
