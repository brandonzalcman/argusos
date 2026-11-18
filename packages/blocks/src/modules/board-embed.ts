import { createBlockStub } from "../stub.js";

export const boardEmbedBlock = createBlockStub(
  "board-embed",
  "Embedded board",
  "Shows a published board inside a page, with the viewer's own permissions.",
  "layout",
);
