import type { BlockConfig } from "../model.js";

/** Link target as authored in a link-list block (mirrors LinkListItem in @argus/blocks). */
export type LinkTarget =
  | { readonly type: "board"; readonly boardId: string }
  | { readonly type: "page"; readonly pageId: string }
  | { readonly type: "url"; readonly url: string };

export interface LinkItem {
  readonly label: string;
  readonly target: LinkTarget;
  readonly icon: string | null;
}

export interface LinkListModel {
  readonly title: string | null;
  readonly layout: "list" | "grid";
  readonly links: readonly LinkItem[];
}

/**
 * Returns the normalized URL only for http(s); everything else (javascript:, data:, relative,
 * credentials-in-URL, malformed) is rejected so an authored link can never run script.
 */
export function safeExternalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  return url.href;
}

function readTarget(raw: unknown): LinkTarget | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.type === "board" && typeof record.boardId === "string" && record.boardId !== "") {
    return { type: "board", boardId: record.boardId };
  }
  if (record.type === "page" && typeof record.pageId === "string" && record.pageId !== "") {
    return { type: "page", pageId: record.pageId };
  }
  if (record.type === "url" && typeof record.url === "string") {
    return { type: "url", url: record.url };
  }
  return null;
}

/** Reads a link-list config defensively; malformed items are dropped, never thrown on. */
export function readLinkList(config: BlockConfig): LinkListModel {
  const rawLinks: unknown = config.links;
  const links: LinkItem[] = [];
  if (Array.isArray(rawLinks)) {
    for (const item of rawLinks) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const target = readTarget(record.target);
      if (typeof record.label !== "string" || record.label.trim() === "" || !target) continue;
      links.push({
        label: record.label,
        target,
        icon: typeof record.icon === "string" && record.icon !== "" ? record.icon : null,
      });
    }
  }
  return {
    title: typeof config.title === "string" && config.title !== "" ? config.title : null,
    layout: config.layout === "grid" ? "grid" : "list",
    links,
  };
}

export type ResolvedLink =
  | { readonly kind: "board"; readonly boardId: string }
  | { readonly kind: "page"; readonly pageId: string }
  | { readonly kind: "external"; readonly href: string }
  | { readonly kind: "unavailable"; readonly reason: string };

/** Resolves the target to something the view can render; unsafe URLs become "unavailable". */
export function resolveLinkTarget(target: LinkTarget): ResolvedLink {
  switch (target.type) {
    case "board":
      return { kind: "board", boardId: target.boardId };
    case "page":
      return { kind: "page", pageId: target.pageId };
    case "url": {
      const href = safeExternalUrl(target.url);
      return href
        ? { kind: "external", href }
        : { kind: "unavailable", reason: "Link unavailable" };
    }
  }
}
