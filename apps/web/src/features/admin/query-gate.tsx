import { EmptyState, PageContainer, PageHeader } from "@argus/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { useFeatureSession } from "../workflows/feature-scope.js";
import { ErrorState, LoadingSkeleton, SessionUnavailable } from "../workflows/status-views.js";

/**
 * Renders session-missing, loading, error and not-found states around a query result.
 * Input: the query, a noun for messages, page title/description for the non-data states, and a
 * render function for non-null data (which supplies its own PageContainer).
 * Output: the render function's element only when data is present; otherwise a titled, honest state.
 */
export function QueryGate<T>({
  query,
  noun,
  title,
  description,
  emptyDescription,
  children,
}: {
  readonly query: UseQueryResult<T | null>;
  readonly noun: string;
  readonly title: string;
  readonly description: string;
  readonly emptyDescription: string;
  readonly children: (data: T) => ReactNode;
}): ReactElement {
  const session = useFeatureSession();
  const shell = (body: ReactNode): ReactElement => (
    <PageContainer width="default">
      <PageHeader title={title} description={description} />
      {body}
    </PageContainer>
  );
  if (!session) return shell(<SessionUnavailable />);
  if (query.isPending) return shell(<LoadingSkeleton label={`Loading ${noun}`} />);
  if (query.isError) {
    return shell(
      <ErrorState
        title={`Couldn't load ${noun}`}
        error={query.error}
        onRetry={() => void query.refetch()}
      />,
    );
  }
  if (query.data === null || query.data === undefined) {
    return shell(
      <EmptyState size="page" title={`No ${noun} yet`} description={emptyDescription} />,
    );
  }
  return <>{children(query.data)}</>;
}
