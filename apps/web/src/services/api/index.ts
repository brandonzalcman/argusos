import type { BoardsRepositoryPort } from "../../features/boards/model.js";
import type { SessionPort, StudioPort } from "../studio.js";
import { type AuthClient, createAuthClient } from "./auth-client.js";
import { createBoardsRepositoryFromStudio } from "./boards-repository.js";
import { resolveApiBaseUrl } from "./config.js";
import { createSessionApiClient } from "./session-client.js";
import { createStudioApiClient } from "./studio-client.js";
import { createTrpcHttpClient, type FetchLike } from "./trpc-http.js";

export { type AuthClient, createAuthClient } from "./auth-client.js";
export { createBoardsRepositoryFromStudio } from "./boards-repository.js";
export { resolveApiBaseUrl } from "./config.js";
export { createSessionApiClient } from "./session-client.js";
export { createStudioApiClient } from "./studio-client.js";
export {
  ApiClientError,
  createTrpcHttpClient,
  type FetchLike,
  isApiClientError,
  type TrpcHttpClient,
} from "./trpc-http.js";

export interface ApiServicesOptions {
  /** Defaults to `resolveApiBaseUrl()` (VITE_ARGUS_API_URL). */
  readonly baseUrl?: string;
  readonly fetch?: FetchLike;
}

export interface ApiServices {
  readonly studio: StudioPort;
  readonly session: SessionPort;
  readonly auth: AuthClient;
  readonly boards: BoardsRepositoryPort;
}

/** React-free factory: all ports share one HTTP client configuration. */
export function createApiServices(options: ApiServicesOptions = {}): ApiServices {
  const baseUrl = options.baseUrl ?? resolveApiBaseUrl();
  const fetchOption = options.fetch ? { fetch: options.fetch } : {};
  const http = createTrpcHttpClient({ baseUrl, ...fetchOption });
  const studio = createStudioApiClient(http);
  return {
    studio,
    session: createSessionApiClient(http),
    auth: createAuthClient({ baseUrl, ...fetchOption }),
    boards: createBoardsRepositoryFromStudio(studio),
  };
}
