import { createBlockStub } from "../stub.js";

export const richTextBlock = createBlockStub(
  "rich-text",
  "Rich text",
  "Sanitized rich-text document with no trusted HTML injection.",
  "display",
);
