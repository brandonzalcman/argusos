import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core tenant-user reference; display names and email addresses remain subject to permission filtering. */
export const userFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "user",
  displayName: "User",
  description: "Reference to an active user in the same tenant.",
  release: "core",
  postgresType: "uuid",
  filterOperators: ["equals", "not-equals", "in", "not-in", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
