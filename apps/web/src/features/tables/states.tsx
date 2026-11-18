import { ConnectionIndicator, ErrorState, Skeleton, SkeletonGroup, StatusPill } from "@argus/ui";
import type { ReactElement } from "react";
import type { SyncInfo } from "./tables-port.js";

/** Skeleton shaped like rows of content; never a blocking spinner. */
export function LoadingSkeleton({
  label,
  rows = 4,
}: {
  readonly label: string;
  readonly rows?: number;
}): ReactElement {
  return (
    <SkeletonGroup label={label} className="grid gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </SkeletonGroup>
  );
}

/** What failed + retry. The raw message is kept so TODO(implementation) gaps stay searchable. */
export function LoadError({
  title,
  error,
  onRetry,
}: {
  readonly title: string;
  readonly error: Error | undefined;
  readonly onRetry?: (() => void) | undefined;
}): ReactElement {
  return (
    <ErrorState
      title={title}
      {...(error ? { description: error.message } : {})}
      {...(onRetry ? { onRetry } : {})}
    />
  );
}

/** Always says whether what is shown is live, reconnecting, offline or polling. */
export function SyncBadge({ sync }: { readonly sync: SyncInfo | undefined }): ReactElement {
  if (!sync) {
    return <StatusPill status="stale" label="Freshness unknown" size="sm" />;
  }
  if (sync.state === "connecting") {
    return <StatusPill status="info" label="Connecting" size="sm" />;
  }
  return (
    <ConnectionIndicator
      variant="pill"
      state={sync.state}
      stateDetail={sync.detail}
      {...(sync.lastVisibleCommitAt ? { lastUpdatedAt: sync.lastVisibleCommitAt } : {})}
    />
  );
}
