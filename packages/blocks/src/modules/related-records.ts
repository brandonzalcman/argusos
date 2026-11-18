import { createBlockStub } from "../stub.js";

export const relatedRecordsBlock = createBlockStub(
  "related-records",
  "Related records",
  "Records reached through an authorized relation without bypassing incident scoping.",
  "data",
);
