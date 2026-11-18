import type { PageDefinition } from "@argus/schema";

/** TEST ONLY: a minimal, fictional page definition. Never import from production code. */
export function makePageFixture(overrides: Partial<PageDefinition> = {}): PageDefinition {
  const blockId = "a1000000-0000-4000-8000-0000000000b1";
  return {
    tenantId: "a1000000-0000-4000-8000-0000000000a1",
    id: "a1000000-0000-4000-8000-0000000000c1",
    version: 3,
    lifecycle: "published",
    changeSummary: "Test fixture.",
    createdAt: "2026-11-01T00:00:00.000Z",
    createdBy: "a1000000-0000-4000-8000-0000000000d1",
    createdPositionId: "a1000000-0000-4000-8000-0000000000e1",
    publishedAt: "2026-11-01T01:00:00.000Z",
    publishedBy: "a1000000-0000-4000-8000-0000000000d1",
    key: "fixture_page",
    slug: "fixture-page",
    title: "Fixture page",
    description: "Fictional page used by tests.",
    icon: "layout-dashboard",
    dataSources: [],
    blocks: [
      {
        id: blockId,
        type: "rich-text",
        name: "Fixture note",
        config: { contentDocument: "Fictional fixture text." },
        visibilityExpression: null,
        action: null,
        access: { positionIds: [], visibilityRule: null },
      },
    ],
    layouts: [
      {
        breakpoint: "desktop",
        items: [{ blockId, x: 0, y: 0, width: 12, height: 3, hidden: false }],
      },
    ],
    homepageForPositionIds: [],
    access: { positionIds: [], visibilityRule: null },
    ...overrides,
  };
}
