import { describe, it } from "vitest";

describe("versioned definitions", () => {
  it.todo("rejects publishes when expectedVersion does not match the current draft");
  it.todo("keeps published definition revisions immutable when a newer draft is created");
  it.todo("records actor, position, request and change summary for every publication");
  it.todo("restores an old published revision as a new auditable version");
  it.todo("pins runtime boards and workflows to explicit published definition versions");
  it.todo("validates pack dependencies and remaps tenant-owned IDs during import preview");
});
