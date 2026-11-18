import { z } from "zod";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

export const themeModeSchema = z.enum(["light", "dark", "high-contrast"]);
export type ThemeMode = z.infer<typeof themeModeSchema>;

/** Serializable design-token value; token names are mapped to owned CSS variables by @argus/ui. */
export const themeTokensSchema = z.strictObject({
  colors: z.record(z.string(), z.string().max(100)),
  radii: z.record(z.string(), z.string().max(100)),
  spacing: z.record(z.string(), z.string().max(100)),
  typography: z.record(z.string(), z.string().max(200)),
  density: z.enum(["compact", "comfortable"]),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/** Complete mode set required for accessible tenant theming. */
export const themeModeTokensSchema = z.strictObject({
  light: themeTokensSchema,
  dark: themeTokensSchema,
  "high-contrast": themeTokensSchema,
});
export type ThemeModeTokens = z.infer<typeof themeModeTokensSchema>;

/** Tenant terminology used with ICU messages; values are plain text and must be escaped by renderers. */
export const terminologySchema = z.strictObject({
  incident: z.string().min(1).max(100),
  position: z.string().min(1).max(100),
  board: z.string().min(1).max(100),
  record: z.string().min(1).max(100),
});
export type Terminology = z.infer<typeof terminologySchema>;

/** Versioned tenant theme. Logo references are object-storage IDs, never embedded credentials or data URLs. */
export const themeDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  name: z.string().min(1).max(200),
  activeMode: themeModeSchema,
  modes: themeModeTokensSchema,
  terminology: terminologySchema,
  logoAttachmentId: z.string().uuid().nullable(),
  rightToLeft: z.boolean(),
});
export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;
