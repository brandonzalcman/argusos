import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later attachment-reference field. Object storage, malware scanning and signed URLs are not implemented here. */
export const attachmentFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "attachment",
  displayName: "Attachment",
  description: "Permission-controlled references to scanned object-storage attachments.",
  release: "later",
  postgresType: "jsonb",
  filterOperators: ["is-empty", "is-not-empty"],
  formula: null,
  location: null,
});
