import { describe, it } from "vitest";

describe.todo("tables feature UI (needs a DOM test environment and a connected port double)", () => {
  it.todo("renders loading, empty, error and retry states for the catalog, grid and designer");
  it.todo("virtualizes a 50k-row grid, mounting only the visible window");
  it.todo("supports arrow-key navigation, Enter/F2 editing and Escape cancel in the grid");
  it.todo("sends baseVersion with every inline edit and shows the conflict banner on conflict");
  it.todo("keeps new live rows behind the 'N new rows' pill until revealed");
  it.todo(
    "applies a migration only after plan-digest-bound confirmation, typing the table name when destructive",
  );
  it.todo("never renders SQL statements from a MigrationPreview");
});
