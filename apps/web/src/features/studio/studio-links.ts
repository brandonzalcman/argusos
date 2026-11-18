import type { StudioDefinitionKind, StudioDefinitionSummary } from "@argus/schema";

/** Builder (edit) URL for a studio definition. */
export function builderHref(kind: StudioDefinitionKind, id: string): string {
  switch (kind) {
    case "board":
      return `/boards/${id}/builder`;
    case "page":
      return `/studio/pages/${id}`;
    case "component":
      return `/studio/components/${id}`;
  }
}

/** Runtime (view) URL, or null when the definition has no standalone runtime view. */
export function runtimeHref(summary: StudioDefinitionSummary): string | null {
  if (summary.publishedVersion === null) return null;
  if (summary.kind === "board") return `/boards/${summary.id}`;
  if (summary.kind === "page" && summary.slug) return `/p/${summary.slug}`;
  return null;
}

export const kindLabels: Readonly<
  Record<StudioDefinitionKind, { singular: string; plural: string }>
> = {
  board: { singular: "Board", plural: "Boards" },
  page: { singular: "Page", plural: "Pages" },
  component: { singular: "Component", plural: "Components" },
};

/** Suggests a lower_snake_case definition key from a display name. */
export function suggestKey(name: string): string {
  const key = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "");
  return key.slice(0, 63) || "untitled";
}

/** Suggests a URL slug from a display name. */
export function suggestSlug(name: string): string {
  return (
    suggestKey(name).replace(/_/g, "-").replace(/-+/g, "-").slice(0, 80).replace(/-$/, "") || "page"
  );
}

/** "Published v3", "Draft", "Published v3 · unpublished changes". */
export function statusLabel(summary: StudioDefinitionSummary): {
  readonly label: string;
  readonly status: "ok" | "medium" | "stale";
} {
  if (summary.publishedVersion === null) return { label: "Draft", status: "stale" };
  if (summary.hasUnpublishedChanges) {
    return { label: `v${summary.publishedVersion} · unpublished changes`, status: "medium" };
  }
  return { label: `Published v${summary.publishedVersion}`, status: "ok" };
}
