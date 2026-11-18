import { describe, it } from "vitest";

describe("field type registry", () => {
  it.todo("registers every plan section 5.3 field type exactly once");
  it.todo("rejects duplicate plugin IDs before the registry becomes observable");
  it.todo("rejects a plugin whose top-level ID differs from its metadata ID");
  it.todo("returns deterministic core-before-later registration order");
  it.todo("throws a typed lookup error for an unknown field type");
  it.todo("keeps tenant-installed sandbox plugins isolated from the core registry");
  it.todo("exposes exactly twelve Phase 1 core plugins");
});
