/** Every data region renders exactly one of these states; nothing is shown as real until "ready". */
export type LiveQueryState<T> =
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string; readonly retry: () => void }
  | { readonly status: "empty" }
  | { readonly status: "ready"; readonly data: T };

export interface LiveQuerySnapshot<T> {
  readonly hasScope: boolean;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly data: readonly T[] | undefined;
  readonly retry: () => void;
}

/**
 * Maps raw query status to the UI state union.
 * Input: scope presence, TanStack Query status fields and a retry callback.
 * Output: unavailable (no session scope), loading, error, empty or ready.
 * Errors: none; failures become the error state with a printable message.
 * Depends on: nothing; kept pure so it is unit-testable without React.
 */
export function deriveLiveQueryState<T>(
  snapshot: LiveQuerySnapshot<T>,
): LiveQueryState<readonly T[]> {
  if (!snapshot.hasScope) {
    return {
      status: "unavailable",
      reason: "No authenticated tenant or incident scope is available, so nothing is loaded.",
    };
  }
  if (snapshot.error !== null && snapshot.error !== undefined) {
    const message = snapshot.error instanceof Error ? snapshot.error.message : "Request failed.";
    return { status: "error", message, retry: snapshot.retry };
  }
  if (snapshot.isPending || snapshot.data === undefined) {
    return { status: "loading" };
  }
  return snapshot.data.length === 0
    ? { status: "empty" }
    : { status: "ready", data: snapshot.data };
}
