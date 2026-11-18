import { z } from "zod";
import { idSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

export const layoutBreakpointSchema = z.enum(["desktop", "tablet", "phone", "video-wall"]);
export type LayoutBreakpoint = z.infer<typeof layoutBreakpointSchema>;

/** One block placement in the twelve-column grid. The runtime must also enforce x + width <= 12. */
export const layoutItemSchema = z
  .strictObject({
    blockId: idSchema,
    x: z.number().int().min(0).max(11),
    y: z.number().int().nonnegative(),
    width: z.number().int().min(1).max(12),
    height: z.number().int().positive(),
    hidden: z.boolean(),
  })
  .refine((item) => item.x + item.width <= 12, "Layout item exceeds the twelve-column grid.");
export type LayoutItem = z.infer<typeof layoutItemSchema>;

export const responsiveLayoutSchema = z.strictObject({
  breakpoint: layoutBreakpointSchema,
  items: z.array(layoutItemSchema),
});
export type ResponsiveLayout = z.infer<typeof responsiveLayoutSchema>;

/** Reusable versioned layout for a board or position homepage; referenced blocks remain permission-filtered. */
export const layoutDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  name: z.string().min(1).max(200),
  boardId: idSchema.nullable(),
  positionId: idSchema.nullable(),
  columns: z.literal(12),
  layouts: z.array(responsiveLayoutSchema),
});
export type LayoutDefinition = z.infer<typeof layoutDefinitionSchema>;
