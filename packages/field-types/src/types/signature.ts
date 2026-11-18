import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later audited signature field; identity proof, meaning and reauthentication require a dedicated security slice. */
export const signatureFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "signature",
  displayName: "Signature",
  description: "Immutable signature assertion with actor, position, meaning and audit provenance.",
  release: "later",
  postgresType: "jsonb",
  filterOperators: ["is-empty", "is-not-empty"],
  formula: null,
  location: null,
});
