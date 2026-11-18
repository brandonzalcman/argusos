import type { ApiErrorCode } from "@argus/schema";
import { ApiClientError, type FetchLike, readJson } from "./trpc-http.js";

export interface AuthClient {
  signInWithEmail(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface AuthClientOptions {
  readonly baseUrl: string;
  readonly fetch?: FetchLike;
}

function messageOf(json: unknown, fallback: string): string {
  if (typeof json === "object" && json !== null && "message" in json) {
    const message = (json as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function authErrorCode(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return "validation-failed";
  if (status === 403) return "forbidden";
  return "unauthenticated";
}

/**
 * Better Auth email/password client. The session lives in an httpOnly cookie set by the API;
 * credentials are sent once in the POST body and are never logged or stored.
 */
export function createAuthClient(options: AuthClientOptions): AuthClient {
  const base = options.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function post(path: string, body: unknown): Promise<void> {
    let response: Response;
    try {
      response = await doFetch(`${base}/api/auth${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiClientError({
        code: "unavailable",
        message: "Could not reach the ArgusOS API",
        retryable: true,
      });
    }
    if (response.ok) return;
    const json = await readJson(response);
    const status = response.status;
    if (status >= 500 || json === undefined) {
      throw new ApiClientError({
        code: status >= 500 ? "unavailable" : "internal",
        message: "The ArgusOS API returned an unreadable or failed response",
        retryable: status >= 500,
        httpStatus: status,
      });
    }
    if (status === 429) {
      throw new ApiClientError({
        code: "rate-limited",
        message: messageOf(json, "Too many attempts"),
        retryable: true,
        httpStatus: status,
      });
    }
    throw new ApiClientError({
      code: authErrorCode(status),
      message: messageOf(json, "Sign-in failed"),
      httpStatus: status,
    });
  }

  return {
    signInWithEmail: (email, password) => post("/sign-in/email", { email, password }),
    signOut: () => post("/sign-out", {}),
  };
}
