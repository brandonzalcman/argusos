import type { BoardDefinition, OperationContext } from "@argus/schema";
import type { ReactNode } from "react";
import type { BlockConfigByKind, BlockKind } from "./block-configs.js";
import type { BoardDataPort } from "./data-port.js";
import type { ResponsiveBoardLayout } from "./layout-types.js";
import type { BlockRegistry } from "./registry.js";

/** Server-established tenant/incident/actor boundary reused from @argus/schema. */
export type BlockSecurityScope = OperationContext;

export interface BlockRenderContext {
  readonly scope: BlockSecurityScope;
  readonly boardId: string;
  readonly definitionVersion: number;
  readonly previewPositionId?: string;
  readonly mode: "runtime" | "builder" | "print";
}

export type BlockCategory =
  | "data"
  | "display"
  | "layout"
  | "action"
  | "media"
  | "collaboration"
  | "external";

export interface BlockRendererProps<K extends BlockKind = BlockKind> {
  readonly blockId: string;
  readonly config: BlockConfigByKind[K];
  readonly context: BlockRenderContext;
  readonly data: BoardDataPort;
}

export interface BlockModule<K extends BlockKind = BlockKind> {
  readonly kind: K;
  readonly displayName: string;
  readonly description: string;
  readonly category: BlockCategory;
  /** Implementations must enforce field/view/action authorization and never render hidden data. */
  readonly render: (props: BlockRendererProps<K>) => ReactNode;
}

export type AnyBlockModule = {
  [K in BlockKind]: BlockModule<K>;
}[BlockKind];

/** Published board document and reusable layout remain owned by @argus/schema. */
export interface BoardRendererProps<TBoardDefinition = BoardDefinition> {
  readonly definition: TBoardDefinition;
  readonly layout: ResponsiveBoardLayout;
  readonly registry: BlockRegistry;
  readonly context: BlockRenderContext;
  readonly data: BoardDataPort;
}

export interface BoardRendererPort {
  readonly render: <TBoardDefinition = BoardDefinition>(
    props: BoardRendererProps<TBoardDefinition>,
  ) => ReactNode;
}
