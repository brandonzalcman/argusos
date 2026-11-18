import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { useFeatureSession } from "../workflows/feature-scope.js";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SessionUnavailable,
} from "../workflows/status-views.js";

/**
 * Renders session-missing, loading, error and not-found states around a query result.
 * Input: the query, a noun for messages, and a render function for non-null data.
 * Output: the render function's element only when data is present; otherwise an honest state.
 */
export function QueryGate<T>({
  query,
  noun,
  emptyDescription,
  children,
}: {
  readonly query: UseQueryResult<T | null>;
  readonly noun: string;
  readonly emptyDescription: string;
  readonly children: (data: T) => ReactNode;
}): ReactElement {
  const session = useFeatureSession();
  if (!session) return <SessionUnavailable />;
  if (query.isPending) return <LoadingSkeleton label={`Loading ${noun}`} />;
  if (query.isError) {
    return (
      <ErrorState
        title={`${noun} failed to load`}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.data === null || query.data === undefined) {
    return <EmptyState title={`No ${noun} yet`} description={emptyDescription} />;
  }
  return <>{children(query.data)}</>;
}
