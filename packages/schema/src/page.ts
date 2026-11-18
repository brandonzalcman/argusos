import { z } from "zod";
import { viewAccessPolicySchema } from "./access.js";
import { blockDefinitionSchema } from "./block.js";
import { boardDataSourceSchema } from "./board.js";
import { responsiveLayoutSchema } from "./layout.js";
import { definitionKeySchema, idSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/** URL path segment for a user-built page, served at `/p/<slug>`. Lowercase, hyphen-separated. */
export const pageSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase, hyphen-separated slug.");
export type PageSlug = z.infer<typeof pageSlugSchema>;

/**
 * User-built page: a versioned, composable layout of blocks (KPIs, embedded boards, links, maps,
 * custom components ...) with its own URL. Boards stay data-centric (sources + views); pages compose.
 * Pages are interpreted by the runtime renderer, never compiled into application code.
 * Blocks and layouts are embedded (not a separate LayoutDefinition) so a page is one document.
 * Security: `access` and block visibility are additional restrictions, never grants; every block
 * still enforces table, record and field authorization at render and query time.
 */
export const pageDefinitionSchema = tenantVersionedDefinitionBaseSchema
  .extend({
    key: definitionKeySchema,
    slug: pageSlugSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2_000).nullable(),
    /** Lucide icon name for menus; unknown names fall back to a generic page icon. */
    icon: z.string().max(100).nullable(),
    /** Optional table sources shared by the page's data blocks (may be empty). */
    dataSources: z.array(boardDataSourceSchema),
    blocks: z.array(blockDefinitionSchema),
    /** One layout per authored breakpoint; at least one is required. */
    layouts: z.array(responsiveLayoutSchema).min(1),
    /** Positions whose homepage is this page. The server rejects one position on two pages. */
    homepageForPositionIds: z.array(idSchema),
    access: viewAccessPolicySchema,
  })
  .superRefine((page, context) => {
    const blockIds = new Set(page.blocks.map((block) => block.id));
    if (blockIds.size !== page.blocks.length) {
      context.addIssue({ code: "custom", path: ["blocks"], message: "Block ids must be unique." });
    }
    const breakpoints = new Set<string>();
    page.layouts.forEach((layout, layoutIndex) => {
      if (breakpoints.has(layout.breakpoint)) {
        context.addIssue({
          code: "custom",
          path: ["layouts", layoutIndex, "breakpoint"],
          message: `Duplicate layout for breakpoint "${layout.breakpoint}".`,
        });
      }
      breakpoints.add(layout.breakpoint);
      layout.items.forEach((item, itemIndex) => {
        if (!blockIds.has(item.blockId)) {
          context.addIssue({
            code: "custom",
            path: ["layouts", layoutIndex, "items", itemIndex, "blockId"],
            message: "Layout item references a block that does not exist.",
          });
        }
      });
    });
  });
export type PageDefinition = z.infer<typeof pageDefinitionSchema>;
