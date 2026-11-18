import { type ApiErrorCode, apiErrorSchema } from "@argus/schema";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientErrorInit {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly requestId?: string | null;
  readonly retryable?: boolean;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly details?: Readonly<Record<string, unknown>> | null;
  readonly httpStatus?: number | null;
}

/** Sanitized API failure as seen by the web app; never contains credentials. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly requestId: string | null;
  readonly retryable: boolean;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly details: Readonly<Record<string, unknown>> | null;
  readonly httpStatus: number | null;

  constructor(init: ApiClientErrorInit) {
    super(init.message);
    this.name = "ApiClientError";
    this.code = init.code;
    this.requestId = init.requestId ?? null;
    this.retryable = init.retryable ?? false;
    this.fieldErrors = init.fieldErrors ?? {};
    this.details = init.details ?? null;
    this.httpStatus = init.httpStatus ?? null;
  }
}

export function isApiClientError(error: unknown, code?: ApiErrorCode): error is ApiClientError {
  return error instanceof ApiClientError && (code === undefined || error.code === code);
}

const TRPC_CODE_MAP: Readonly<Record<string, ApiErrorCode>> = {
  UNAUTHORIZED: "unauthenticated",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not-found",
  CONFLICT: "definition-version-conflict",
  BAD_REQUEST: "validation-failed",
};

const STATUS_CODE_MAP: Readonly<Record<number, ApiErrorCode>> = {
  401: "unauthenticated",
  403: "forbidden",
  429: "rate-limited",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unavailable(message: string, httpStatus: number | null): ApiClientError {
  return new ApiClientError({ code: "unavailable", message, retryable: true, httpStatus });
}

/** Maps a tRPC error body to an ApiClientError. */
export function parseErrorBody(body: unknown, httpStatus: number): ApiClientError {
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  const data = error && isRecord(error.data) ? error.data : null;
  const parsed = apiErrorSchema.safeParse(data?.apiError);
  if (parsed.success) {
    return new ApiClientError({ ...parsed.data, httpStatus });
  }
  const trpcCode = typeof data?.code === "string" ? data.code : "";
  // Non-tRPC bodies (e.g. the CSRF origin guard's `{"error":"origin-not-allowed"}`) fall back to the status.
  const code = TRPC_CODE_MAP[trpcCode] ?? STATUS_CODE_MAP[httpStatus] ?? "internal";
  const message =
    error && typeof error.message === "string" && error.message ? error.message : "Request failed";
  return new ApiClientError({ code, message, retryable: httpStatus >= 500, httpStatus });
}

/** Reads a response as JSON; empty or non-JSON bodies resolve to `undefined`. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

export interface TrpcHttpClientOptions {
  readonly baseUrl: string;
  readonly fetch?: FetchLike;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
}

export interface TrpcHttpClient {
  query<T = unknown>(path: string, input?: unknown, options?: RequestOptions): Promise<T>;
  mutation<T = unknown>(path: string, input?: unknown, options?: RequestOptions): Promise<T>;
}

/**
 * Minimal tRPC v11 non-batched httpLink client (no transformer). Cookies are always sent
 * (`credentials: "include"`); tenant/user/position are never sent by the client.
 */
export function createTrpcHttpClient(options: TrpcHttpClientOptions): TrpcHttpClient {
  const base = `${options.baseUrl.replace(/\/+$/, "")}/trpc`;
  const doFetch: FetchLike = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function send<T>(url: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(url, { ...init, credentials: "include" });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
      throw unavailable("Could not reach the ArgusOS API", null);
    }
    const body = await readJson(response);
    if (body === undefined) {
      throw unavailable("The ArgusOS API returned an unreadable response", response.status);
    }
    if (!response.ok || (isRecord(body) && "error" in body)) {
      throw parseErrorBody(body, response.status);
    }
    if (!isRecord(body) || !isRecord(body.result) || !("data" in body.result)) {
      throw unavailable("The ArgusOS API returned an unreadable response", response.status);
    }
    return body.result.data as T;
  }

  return {
    query(path, input, opts) {
      const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
      return send(`${base}/${path}${qs}`, {
        method: "GET",
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
    },
    mutation(path, input, opts) {
      return send(`${base}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...(input === undefined ? {} : { body: JSON.stringify(input) }),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
    },
  };
}
