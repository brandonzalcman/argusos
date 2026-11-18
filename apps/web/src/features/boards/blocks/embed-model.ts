import { createContext, useContext } from "react";

/** An embedded board may itself embed boards, but never deeper than this many levels. */
export const MAX_EMBED_DEPTH = 2;

export type EmbedCheck = "ok" | "cycle" | "too-deep";

/**
 * Guards board-embed recursion.
 * `chain` is the ids of the definitions currently being rendered, outermost first (the root page or
 * board included). Embedding is a cycle when the target is already in the chain, and too deep when
 * it would be nested more than MAX_EMBED_DEPTH levels below the root.
 */
export function checkEmbed(chain: readonly string[], boardId: string): EmbedCheck {
  if (chain.includes(boardId)) return "cycle";
  if (chain.length > MAX_EMBED_DEPTH) return "too-deep";
  return "ok";
}

/** Ancestors of the block being rendered; empty at the root (the root id is added from the context). */
const EmbedChainContext = createContext<readonly string[]>([]);
export const EmbedChainProvider = EmbedChainContext.Provider;

export function useEmbedChain(): readonly string[] {
  return useContext(EmbedChainContext);
}
