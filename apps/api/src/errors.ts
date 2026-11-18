import { randomUUID } from "node:crypto";
import { type ApiError, type ApiErrorCode, apiErrorSchema, type JsonValue } from "@argus/schema";
import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import { ZodError } from "zod";

const TRPC_CODE_BY_API_CODE: Readonly<Record<ApiErrorCode, TRPC_ERROR_CODE_KEY>> = {
  unauthenticated: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  "tenant-mismatch": "FORBIDDEN",
  "incident-scope-required": "BAD_REQUEST",
  "not-found": "NOT_FOUND",
  "validation-failed": "BAD_REQUEST",
  "definition-version-conflict": "CONFLICT",
  "record-version-conflict": "CONFLICT",
  "field-conflict": "CONFLICT",
  "rate-limited": "TOO_MANY_REQUESTS",
  "payload-too-large": "PAYLOAD_TOO_LARGE",
  "dependency-conflict": "CONFLICT",
  unavailable: "SERVICE_UNAVAILABLE",
  internal: "INTERNAL_SERVER_ERROR",
};

const API_CODE_BY_TRPC_CODE: Readonly<Partial<Record<TRPC_ERROR_CODE_KEY, ApiErrorCode>>> = {
  UNAUTHORIZED: "unauthenticated",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not-found",
  BAD_REQUEST: "validation-failed",
  PARSE_ERROR: "validation-failed",
  UNPROCESSABLE_CONTENT: "validation-failed",
  CONFLICT: "dependency-conflict",
  TOO_MANY_REQUESTS: "rate-limited",
  PAYLOAD_TOO_LARGE: "payload-too-large",
  SERVICE_UNAVAILABLE: "unavailable",
  TIMEOUT: "unavailable",
};

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set(["rate-limited", "unavailable"]);

export interface ApiErrorOptions {
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly details?: Readonly<Record<string, JsonValue>>;
  readonly retryable?: boolean;
}

/** Cause carried by every error created through {@link apiError}; read back by the error formatter. */
export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly details: Readonly<Record<string, JsonValue>> | null;
  readonly retryable: boolean;

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.fieldErrors = options.fieldErrors ?? {};
    this.details = options.details ?? null;
    this.retryable = options.retryable ?? RETRYABLE.has(code);
  }
}

/**
 * Create a tRPC error carrying a stable {@link ApiErrorCode}. The message must be safe for clients:
 * never include SQL, stack traces, secrets, or data from other tenants.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  options?: ApiErrorOptions,
): TRPCError {
  return new TRPCError({
    code: TRPC_CODE_BY_API_CODE[code],
    message,
    cause: new ApiRequestError(code, message, options),
  });
}

const GENERIC_INTERNAL_MESSAGE = "An internal error occurred.";

function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    const list = out[key] ?? [];
    list.push(issue.message);
    out[key] = list;
  }
  return out;
}

function safeClientMessage(message: string): string {
  return message.length > 0 && message.length <= 500 ? message : "Request failed.";
}

/** Convert any error seen by tRPC into a sanitized {@link ApiError}. */
export function toApiError(error: TRPCError, requestId: string): ApiError {
  const cause = error.cause;
  if (cause instanceof ApiRequestError) {
    return apiErrorSchema.parse({
      code: cause.code,
      message: cause.message,
      requestId,
      retryable: cause.retryable,
      fieldErrors: Object.fromEntries(
        Object.entries(cause.fieldErrors).map(([key, value]) => [key, [...value]]),
      ),
      details: cause.details === null ? null : { ...cause.details },
    });
  }
  const mapped = API_CODE_BY_TRPC_CODE[error.code];
  if (mapped === undefined) {
    // Unknown or internal failure: never forward the original message (may contain SQL or paths).
    return apiErrorSchema.parse({
      code: "internal",
      message: GENERIC_INTERNAL_MESSAGE,
      requestId,
      retryable: false,
      fieldErrors: {},
      details: null,
    });
  }
  const zod = cause instanceof ZodError ? cause : null;
  return apiErrorSchema.parse({
    code: mapped,
    message: zod === null ? safeClientMessage(error.message) : "Input validation failed.",
    requestId,
    retryable: RETRYABLE.has(mapped),
    fieldErrors: zod === null ? {} : zodFieldErrors(zod),
    details: null,
  });
}

interface FormatterOptions<TShape extends { message: string; data: object }> {
  readonly error: TRPCError;
  readonly shape: TShape;
  readonly ctx?: { readonly requestId?: string } | undefined;
}

/**
 * tRPC `errorFormatter`: puts the sanitized {@link ApiError} in `shape.data.apiError`, replaces the
 * message with the sanitized one and always drops stack traces.
 */
export function formatApiError<TShape extends { message: string; data: object }>({
  error,
  shape,
  ctx,
}: FormatterOptions<TShape>) {
  const value = toApiError(error, ctx?.requestId ?? randomUUID());
  return {
    ...shape,
    message: value.message,
    data: { ...shape.data, stack: undefined, apiError: value },
  };
}
