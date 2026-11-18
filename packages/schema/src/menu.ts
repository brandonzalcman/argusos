import { z } from "zod";
import { celExpressionSchema, idSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

export interface MenuItem {
  id: string;
  type: "board" | "page" | "url" | "workflow" | "section";
  label: string;
  targetId: string | null;
  url: string | null;
  icon: string | null;
  positionIds: string[];
  visibilityExpression: string | null;
  children: MenuItem[];
}

/** Recursive side-menu item. Position/visibility filters are UX only; target authorization is still required. */
export const menuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.strictObject({
    id: idSchema,
    type: z.enum(["board", "page", "url", "workflow", "section"]),
    label: z.string().min(1).max(200),
    targetId: idSchema.nullable(),
    url: z.string().url().max(2_048).nullable(),
    icon: z.string().max(100).nullable(),
    positionIds: z.array(idSchema),
    visibilityExpression: celExpressionSchema.nullable(),
    children: z.array(menuItemSchema),
  }),
);

/** Versioned, position-aware navigation definition. External URLs require safe protocol handling in the UI. */
export const menuDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  name: z.string().min(1).max(200),
  items: z.array(menuItemSchema),
});
export type MenuDefinition = z.infer<typeof menuDefinitionSchema>;
