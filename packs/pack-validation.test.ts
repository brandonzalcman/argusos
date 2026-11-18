import { describe, it } from "vitest";

describe.todo("Starter pack manifests", () => {
  it.todo("discovers exactly the nine product-plan pack placeholders by stable unique ID");
  it.todo("validates format, schemaVersion, pack version, status and capability metadata");
  it.todo("requires semantic pack versions and a supported draft schema version");
  it.todo("requires empty table, board, workflow and menu arrays while status is non-importable");
  it.todo("rejects unknown fields, malformed dependency ranges and undeclared capabilities");
});

describe.todo("Future pack validation and import", () => {
  it.todo("validates every definition against @argus/schema and resolves dependency digests");
  it.todo("verifies required capabilities before exposing an install action");
  it.todo("previews physical migrations, destructive changes and incompatible dependencies");
  it.todo("authorizes installation for the target tenant without trusting manifest tenant claims");
  it.todo("installs atomically with an audit event and no partial catalog or physical tables");
  it.todo(
    "creates a reversible new catalog version without deleting prior versions or audit history",
  );
  it.todo(
    "rejects executable content, unsafe identifiers, unbounded plugins and unexpected network grants",
  );
});
