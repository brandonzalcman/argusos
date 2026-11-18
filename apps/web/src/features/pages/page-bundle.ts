import type { PageDefinition } from "@argus/schema";
import type { BoardBundle } from "../boards/index.js";

/*
 * Adapter between a PageDefinition and the BoardBundle shape the shared builder machinery edits
 * (definition.blocks + layout.layouts). Pages stay the single source of truth: the bundle is a
 * derived view, never persisted, and `bundleToPage` copies only the fields a bundle edit can
 * change. Page-only fields (slug, title, icon, homepageForPositionIds, access, description,
 * identity and revision metadata) always come from the page.
 */

/** Derives the board-shaped view of a page. Pure; never mutates `page`. */
export function pageToBundle(page: PageDefinition): BoardBundle {
  const metadata = {
    tenantId: page.tenantId,
    id: page.id,
    version: page.version,
    lifecycle: page.lifecycle,
    changeSummary: page.changeSummary,
    createdAt: page.createdAt,
    createdBy: page.createdBy,
    createdPositionId: page.createdPositionId,
    publishedAt: page.publishedAt,
    publishedBy: page.publishedBy,
  };
  return {
    definition: {
      ...metadata,
      key: page.key,
      name: page.title,
      description: page.description,
      dataSources: page.dataSources,
      views: [],
      blocks: page.blocks,
      layoutId: page.id,
      access: page.access,
    },
    layout: {
      ...metadata,
      name: page.title,
      boardId: null,
      positionId: null,
      columns: 12,
      layouts: page.layouts,
    },
  };
}

/**
 * Applies a bundle edit back to the page: only blocks, data sources and layouts are taken from the
 * bundle. A bundle with no layouts keeps the page's (a page needs at least one).
 */
export function bundleToPage(page: PageDefinition, bundle: BoardBundle): PageDefinition {
  return {
    ...page,
    dataSources: bundle.definition.dataSources,
    blocks: bundle.definition.blocks,
    layouts: bundle.layout.layouts.length > 0 ? bundle.layout.layouts : page.layouts,
  };
}
