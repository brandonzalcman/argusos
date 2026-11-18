import { z } from "zod";
import { idSchema, jsonValueSchema } from "./primitives.js";

/** Stable machine-readable API errors safe for clients and integrations to switch on. */
export const apiErrorCodeSchema = z.enum([
  "unauthenticated",
  "forbidden",
  "tenant-mismatch",
  "incident-scope-required",
  "not-found",
  "validation-failed",
  "definition-version-conflict",
  "record-version-conflict",
  "field-conflict",
  "rate-limited",
  "payload-too-large",
  "dependency-conflict",
  "unavailable",
  "internal",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Sanitized API error. Stack traces, secrets, SQL and hidden field values must never be included in details. */
export const apiErrorSchema = z.strictObject({
  code: apiErrorCodeSchema,
  message: z.string().min(1).max(2_000),
  requestId: idSchema,
  retryable: z.boolean(),
  fieldErrors: z.record(z.string(), z.array(z.string())),
  details: z.record(z.string(), jsonValueSchema).nullable(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const paginationSchema = z.strictObject({
  cursor: z.string().min(1).max(2_000).nullable(),
  nextCursor: z.string().min(1).max(2_000).nullable(),
  hasMore: z.boolean(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const apiResponseMetaSchema = z.strictObject({
  requestId: idSchema,
  pagination: paginationSchema.nullable(),
});
export type ApiResponseMeta = z.infer<typeof apiResponseMetaSchema>;

/**
 * Builds a successful result schema for a payload.
 * Input: payload schema. Output: `{ success: true, data, meta }` schema. Errors: Zod parse failures only.
 * Depends on transport handlers to populate request IDs and sanitize data by authorization.
 */
export function apiSuccessSchema<TData extends z.ZodType>(data: TData) {
  return z.strictObject({ success: z.literal(true), data, meta: apiResponseMetaSchema });
}

/** Failure half of the API result union; HTTP mapping and error logging belong to apps/api. */
export const apiFailureSchema = z.strictObject({
  success: z.literal(false),
  error: apiErrorSchema,
});
export type ApiFailure = z.infer<typeof apiFailureSchema>;

/**
 * Builds a discriminated API result schema for a payload.
 * Input: success payload schema. Output: success/failure union schema. Errors: Zod parse failures only.
 * Depends on API handlers to avoid leaking sensitive values in either half.
 */
export function apiResultSchema<TData extends z.ZodType>(data: TData) {
  return z.discriminatedUnion("success", [apiSuccessSchema(data), apiFailureSchema]);
}

export interface ApiSuccess<TData> {
  success: true;
  data: TData;
  meta: ApiResponseMeta;
}

/** Transport-independent typed result returned by app and generated table APIs. */
export type ApiResult<TData> = ApiSuccess<TData> | ApiFailure;
