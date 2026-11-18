import { EmptyState, ErrorState, Skeleton, SkeletonGroup } from "@argus/ui";
import type { ReactElement, ReactNode } from "react";
import type { LiveQueryState } from "./live-query-state.js";

export interface QueryBoundaryProps<T> {
  readonly state: LiveQueryState<T>;
  /** Noun for the region being loaded, e.g. "incidents". */
  readonly label: string;
  /** What the empty state explains, and optionally its primary action. */
  readonly empty: {
    readonly title: string;
    readonly description?: string;
    readonly action?: ReactNode;
  };
  readonly children: (data: T) => ReactNode;
}

/**
 * Renders the loading, unavailable, error and empty states every data region must handle.
 * Input: a LiveQueryState, a region label, empty-state copy and a ready renderer.
 * Output: SkeletonGroup, EmptyState (not connected / empty), ErrorState with retry, or content.
 * Errors: none itself; retry re-invokes the query.
 * Depends on: live-query-state and @argus/ui state components.
 */
export function QueryBoundary<T>({
  state,
  label,
  empty,
  children,
}: QueryBoundaryProps<T>): ReactElement {
  switch (state.status) {
    case "loading":
      return (
        <SkeletonGroup label={`Loading ${label}`} className="grid gap-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </SkeletonGroup>
      );
    case "unavailable":
      return (
        <EmptyState
          size="inline"
          title={`${capitalize(label)} are not connected`}
          description={state.reason}
        />
      );
    case "error":
      return (
        <ErrorState
          size="inline"
          title={`Could not load ${label}`}
          description={state.message}
          onRetry={state.retry}
        />
      );
    case "empty":
      return (
        <EmptyState
          size="inline"
          title={empty.title}
          {...(empty.description === undefined ? {} : { description: empty.description })}
          {...(empty.action === undefined ? {} : { action: empty.action })}
        />
      );
    case "ready":
      return <>{children(state.data)}</>;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
