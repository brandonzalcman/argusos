import type { PageDefinition } from "@argus/schema";
import { stableStringify } from "../boards/index.js";

/**
 * Plain-language list of what changed between two page revisions, for the publish dialog and the
 * suggested change summary. Pure. `before` null means the page was never published.
 */
export function summarizePageChanges(
  before: PageDefinition | null,
  after: PageDefinition,
): readonly string[] {
  if (!before) {
    return [
      `First publication at /p/${after.slug} with ${after.blocks.length} block${after.blocks.length === 1 ? "" : "s"}.`,
    ];
  }
  const changes: string[] = [];
  if (before.title !== after.title) changes.push(`Title: "${before.title}" to "${after.title}".`);
  if (before.slug !== after.slug)
    changes.push(`URL changes from /p/${before.slug} to /p/${after.slug}; old links stop working.`);
  if (before.description !== after.description) changes.push("Description changed.");
  if (before.icon !== after.icon) changes.push("Icon changed.");

  const beforeBlocks = new Map(before.blocks.map((block) => [block.id, block] as const));
  const afterIds = new Set(after.blocks.map((block) => block.id));
  const added = after.blocks.filter((block) => !beforeBlocks.has(block.id));
  const removed = before.blocks.filter((block) => !afterIds.has(block.id));
  const modified = after.blocks.filter((block) => {
    const previous = beforeBlocks.get(block.id);
    return previous !== undefined && stableStringify(previous) !== stableStringify(block);
  });
  if (added.length > 0) changes.push(`Added: ${added.map((block) => block.name).join(", ")}.`);
  if (removed.length > 0) {
    changes.push(`Removed: ${removed.map((block) => block.name).join(", ")}.`);
  }
  if (modified.length > 0) {
    changes.push(`Edited: ${modified.map((block) => block.name).join(", ")}.`);
  }
  if (stableStringify(before.layouts) !== stableStringify(after.layouts)) {
    changes.push("Layout changed.");
  }
  if (stableStringify(before.access) !== stableStringify(after.access)) {
    changes.push("Who can view the page changed.");
  }
  if (
    stableStringify(before.homepageForPositionIds) !== stableStringify(after.homepageForPositionIds)
  ) {
    changes.push("Homepage positions changed.");
  }
  if (stableStringify(before.dataSources) !== stableStringify(after.dataSources)) {
    changes.push("Data sources changed.");
  }
  return changes;
}
