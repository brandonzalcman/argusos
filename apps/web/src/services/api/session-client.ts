import { sessionSnapshotSchema } from "@argus/schema";
import type { SessionPort } from "../studio.js";
import { isApiClientError, type TrpcHttpClient } from "./trpc-http.js";
import { parseOutput } from "./validate.js";

const nullableSnapshot = sessionSnapshotSchema.nullable();

/** `session` tRPC router client. `get` resolves null when signed out (null body or 401). */
export function createSessionApiClient(http: TrpcHttpClient): SessionPort {
  return {
    get: async () => {
      try {
        return parseOutput(nullableSnapshot, await http.query("session.get"));
      } catch (error) {
        if (isApiClientError(error, "unauthenticated")) return null;
        throw error;
      }
    },
    selectPosition: async (input) =>
      parseOutput(sessionSnapshotSchema, await http.mutation("session.selectPosition", input)),
    selectIncident: async (input) =>
      parseOutput(sessionSnapshotSchema, await http.mutation("session.selectIncident", input)),
  };
}
