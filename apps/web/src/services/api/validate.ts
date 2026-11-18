import type { z } from "zod";
import { ApiClientError } from "./trpc-http.js";

/** Validates a successful response against its shared contract schema. */
export function parseOutput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiClientError({ code: "internal", message: "response did not match contract" });
  }
  return result.data;
}
