import { createBlockStub } from "../stub.js";

export const customComponentBlock = createBlockStub(
  "custom-component",
  "Custom component",
  "User-written component running in the sandboxed runtime with approved capabilities.",
  "external",
);
