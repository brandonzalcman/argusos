import { pageSlugSchema } from "@argus/schema";

/**
 * Human-readable slug problem, or null when valid. The schema stays authoritative
 * (`pageSlugSchema`); this only turns its rule into an actionable message.
 */
export function validatePageSlug(slug: string): string | null {
  if (slug.length === 0) return "Enter a URL slug, for example duty-officer.";
  if (slug.length > 80) return "Use at most 80 characters.";
  if (pageSlugSchema.safeParse(slug).success) return null;
  if (/[A-Z]/.test(slug)) return "Use lowercase letters only.";
  if (/\s/.test(slug)) return "Replace spaces with hyphens.";
  if (/_/.test(slug)) return "Use hyphens instead of underscores.";
  if (slug.startsWith("-") || slug.endsWith("-")) return "Don't start or end with a hyphen.";
  if (slug.includes("--")) return "Use a single hyphen between words.";
  return "Use only lowercase letters, digits and single hyphens.";
}

/** Path the page is served at; empty or invalid slugs show a placeholder. */
export function pageUrlPath(slug: string): string {
  return `/p/${validatePageSlug(slug) === null ? slug : "…"}`;
}
