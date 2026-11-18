const DEFAULT_API_URL = "http://localhost:3001";

/**
 * Resolves the ArgusOS API origin from `VITE_ARGUS_API_URL` (default http://localhost:3001).
 * Only http/https URLs are accepted (a path prefix is allowed for reverse proxies; credentials, query
 * and fragment are rejected); the trailing slash is trimmed. Throws on anything else.
 */
export function resolveApiBaseUrl(
  raw: string | undefined = import.meta.env.VITE_ARGUS_API_URL,
): string {
  const value = (raw ?? "").trim() || DEFAULT_API_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VITE_ARGUS_API_URL must be an absolute http(s) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_ARGUS_API_URL must use http or https");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("VITE_ARGUS_API_URL must not contain credentials");
  }
  if (url.search !== "" || url.hash !== "" || value.includes("?") || value.includes("#")) {
    throw new Error("VITE_ARGUS_API_URL must not contain a query string or fragment");
  }
  return value.replace(/\/+$/, "");
}
