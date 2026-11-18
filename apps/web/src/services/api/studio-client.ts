import {
  studioGetOutputSchema,
  studioListOutputSchema,
  studioMutationOutputSchema,
  studioValidateOutputSchema,
  studioVersionSummarySchema,
} from "@argus/schema";
import { z } from "zod";
import type { StudioPort } from "../studio.js";
import type { TrpcHttpClient } from "./trpc-http.js";
import { parseOutput } from "./validate.js";

const nullableGet = studioGetOutputSchema.nullable();
const versions = z.array(studioVersionSummarySchema);

/**
 * `studio` tRPC router client; every method maps 1:1 to a procedure of the same name. `validate` is
 * a POST mutation: documents (up to 200k chars of component source) do not fit in URLs and must not
 * reach access logs.
 */
export function createStudioApiClient(http: TrpcHttpClient): StudioPort {
  return {
    list: async (input) =>
      parseOutput(studioListOutputSchema, await http.query("studio.list", input)),
    get: async (input) => parseOutput(nullableGet, await http.query("studio.get", input)),
    getPageBySlug: async (input) =>
      parseOutput(nullableGet, await http.query("studio.getPageBySlug", input)),
    listVersions: async (input) =>
      parseOutput(versions, await http.query("studio.listVersions", input)),
    create: async (input) =>
      parseOutput(studioMutationOutputSchema, await http.mutation("studio.create", input)),
    saveDraft: async (input) =>
      parseOutput(studioMutationOutputSchema, await http.mutation("studio.saveDraft", input)),
    publish: async (input) =>
      parseOutput(studioMutationOutputSchema, await http.mutation("studio.publish", input)),
    rollback: async (input) =>
      parseOutput(studioMutationOutputSchema, await http.mutation("studio.rollback", input)),
    archive: async (input) =>
      parseOutput(studioMutationOutputSchema, await http.mutation("studio.archive", input)),
    validate: async (input) =>
      parseOutput(studioValidateOutputSchema, await http.mutation("studio.validate", input)),
  };
}
