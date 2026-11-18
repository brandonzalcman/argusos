import {
  idSchema,
  type StudioValidateInput,
  studioArchiveInputSchema,
  studioCreateInputSchema,
  studioDefinitionKindSchema,
  studioGetInputSchema,
  studioGetOutputSchema,
  studioGetPageBySlugInputSchema,
  studioListInputSchema,
  studioListOutputSchema,
  studioMutationOutputSchema,
  studioPublishInputSchema,
  studioRollbackInputSchema,
  studioSaveDraftInputSchema,
  studioValidateOutputSchema,
  studioVersionSummarySchema,
} from "@argus/schema";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { apiError } from "../errors.js";
import { authedProcedure, callerContextFrom, router } from "../trpc/init.js";
import { createStudioService } from "./service.js";

/**
 * `jsonValueSchema` in @argus/schema is typed `ZodType<JsonValue>`, whose *input* type defaults to `unknown`,
 * so tRPC would infer a wider input than `StudioApi`. Runtime validation is unchanged; this only
 * narrows the inferred input to the contract type (see CONTRACT ISSUES in the task report).
 */
function contractInput<T>(schema: z.ZodType<T>): z.ZodType<T, T> {
  return schema as unknown as z.ZodType<T, T>;
}

const listVersionsInputSchema = z.strictObject({
  kind: studioDefinitionKindSchema,
  id: idSchema,
});

/**
 * `studio.validate` input parser. The document is deliberately NOT parsed here: an invalid
 * document must come back as `DefinitionIssue`s from `validateStudioDocument`, not as a rejected
 * request. The parser only checks the envelope (a plain object holding exactly a `document` key);
 * the document's size is bounded by the HTTP body limit, and the service re-parses it with
 * `studioDocumentSchema`. It is typed as `StudioValidateInput` so the procedure's inferred input
 * equals the `StudioApi` contract; the cast is sound because the service treats the value as
 * `unknown` and never relies on the static type.
 */
function parseValidateInput(raw: unknown): StudioValidateInput {
  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw) ||
    !Object.hasOwn(raw, "document") ||
    Object.keys(raw).length !== 1
  ) {
    throw apiError("validation-failed", "Expected an object with a single `document` member.", {
      fieldErrors: { _: ["Expected { document }."] },
    });
  }
  return raw as StudioValidateInput;
}

/** `studio` tRPC router; procedure names, inputs and outputs equal `StudioApi` (type-tested). */
export function createStudioRouter(deps: { readonly database: Database }) {
  const service = createStudioService({ database: deps.database });
  return router({
    list: authedProcedure
      .input(studioListInputSchema)
      .output(studioListOutputSchema)
      .query(({ ctx, input }) => service.list(callerContextFrom(ctx.context), input)),
    get: authedProcedure
      .input(studioGetInputSchema)
      .output(studioGetOutputSchema.nullable())
      .query(({ ctx, input }) => service.get(callerContextFrom(ctx.context), input)),
    getPageBySlug: authedProcedure
      .input(studioGetPageBySlugInputSchema)
      .output(studioGetOutputSchema.nullable())
      .query(({ ctx, input }) => service.getPageBySlug(callerContextFrom(ctx.context), input)),
    listVersions: authedProcedure
      .input(listVersionsInputSchema)
      .output(z.array(studioVersionSummarySchema))
      .query(({ ctx, input }) => service.listVersions(callerContextFrom(ctx.context), input)),
    validate: authedProcedure
      .input(parseValidateInput)
      .output(studioValidateOutputSchema)
      // A mutation (POST), not a query: documents are up to ~200k chars and must not ride in URLs/access logs.
      .mutation(({ ctx, input }) => service.validate(callerContextFrom(ctx.context), input)),
    create: authedProcedure
      .input(studioCreateInputSchema)
      .output(studioMutationOutputSchema)
      .mutation(({ ctx, input }) => service.create(callerContextFrom(ctx.context), input)),
    saveDraft: authedProcedure
      .input(contractInput(studioSaveDraftInputSchema))
      .output(studioMutationOutputSchema)
      .mutation(({ ctx, input }) => service.saveDraft(callerContextFrom(ctx.context), input)),
    publish: authedProcedure
      .input(studioPublishInputSchema)
      .output(studioMutationOutputSchema)
      .mutation(({ ctx, input }) => service.publish(callerContextFrom(ctx.context), input)),
    rollback: authedProcedure
      .input(studioRollbackInputSchema)
      .output(studioMutationOutputSchema)
      .mutation(({ ctx, input }) => service.rollback(callerContextFrom(ctx.context), input)),
    archive: authedProcedure
      .input(studioArchiveInputSchema)
      .output(studioMutationOutputSchema)
      .mutation(({ ctx, input }) => service.archive(callerContextFrom(ctx.context), input)),
  });
}
