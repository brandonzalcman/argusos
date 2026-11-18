import { createBlockStub } from "../stub.js";

export const buttonBlock = createBlockStub(
  "button",
  "Action button",
  "Authorized, idempotent board action with confirmation and audit context.",
  "action",
);
