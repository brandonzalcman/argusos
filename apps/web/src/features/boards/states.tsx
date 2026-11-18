import {
  Badge as UiBadge,
  EmptyState as UiEmptyState,
  ErrorState as UiErrorState,
  Skeleton,
  SkeletonGroup,
} from "@argus/ui";
import type { ReactElement, ReactNode } from "react";
import { isNotImplementedError } from "./queries.js";

/** Skeleton placeholder (never a blocking spinner); the group label is announced politely. */
export function LoadingState({ label }: { readonly label: string }): ReactElement {
  return (
    <SkeletonGroup label={label} className="grid gap-2">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/5" />
    </SkeletonGroup>
  );
}

export function ErrorState({
  title,
  error,
  onRetry,
}: {
  readonly title: string;
  readonly error: unknown;
  readonly onRetry?: (() => void) | undefined;
}): ReactElement {
  const pending = isNotImplementedError(error);
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <UiErrorState
      size="inline"
      title={title}
      description={
        <>
          {pending
            ? "This data source is not connected yet. Nothing is shown rather than invented data."
            : "The request failed. Try again; if it keeps failing, check your connection."}{" "}
          <code className="font-mono text-xs break-words">{message}</code>
        </>
      }
      {...(onRetry ? { onRetry } : {})}
    />
  );
}

export function EmptyState({
  title,
  children,
}: {
  readonly title: string;
  readonly children?: ReactNode;
}): ReactElement {
  return (
    <UiEmptyState size="inline" title={title} {...(children ? { description: children } : {})} />
  );
}

/** Shown when no authenticated scope is available; nothing is requested without one. */
export function NoScopeState(): ReactElement {
  return (
    <UiErrorState
      size="inline"
      title="No authenticated session scope"
      description="Boards load only inside a server-established tenant, incident and position scope. TODO(implementation): provide the session adapter through BoardsEnvironmentProvider (see features/boards/README.md)."
    />
  );
}

const badgeTone = {
  neutral: "neutral",
  warning: "warning",
  success: "success",
  danger: "critical",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  readonly tone?: keyof typeof badgeTone;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <UiBadge tone={badgeTone[tone]} variant="subtle">
      {children}
    </UiBadge>
  );
}

export function formatTimestamp(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const absolute = date.toLocaleString(undefined, { timeZoneName: "short" });
  const minutes = Math.round((now - date.getTime()) / 60_000);
  let age: string;
  if (minutes < 1) age = "just now";
  else if (minutes < 60) age = `${minutes} min ago`;
  else if (minutes < 60 * 24) age = `${Math.round(minutes / 60)} h ago`;
  else age = `${Math.round(minutes / (60 * 24))} d ago`;
  return `${absolute} · ${age}`;
}
