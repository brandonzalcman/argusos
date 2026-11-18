import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later relation-backed record link. Referential, tenant and incident checks belong to the relation slice. */
export const linkToRecordFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "link-to-record",
  displayName: "Link to record",
  description: "Single or multiple references through a managed relation definition.",
  release: "later",
  postgresType: "uuid",
  filterOperators: ["equals", "not-equals", "contains", "in", "not-in", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
