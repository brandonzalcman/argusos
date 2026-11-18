import {
  Badge,
  EmptyState,
  Skeleton,
  SkeletonGroup,
  ErrorState as UiErrorState,
  type ErrorStateProps as UiErrorStateProps,
} from "@argus/ui";
import { CircleAlert, CircleCheck, LoaderCircle, TriangleAlert } from "@argus/ui/icons";
import type { ReactElement } from "react";

export { EmptyState };

/** Reads the message of an unknown error without leaking anything beyond it. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True for the documented stub rejection `TODO(implementation): …`. */
export function isNotConnectedError(error: unknown): boolean {
  return errorMessage(error).startsWith("TODO(implementation)");
}

export interface ErrorStateProps {
  /** What failed, in plain words: "Couldn't load workflows". */
  readonly title: string;
  readonly error: unknown;
  readonly onRetry?: (() => void) | undefined;
  readonly size?: UiErrorStateProps["size"];
}

/**
 * Failure state for a data area. Not-connected stubs are explained as such (the reference shows
 * the exact TODO) instead of looking like a transient outage.
 */
export function ErrorState({ title, error, onRetry, size }: ErrorStateProps): ReactElement {
  const notConnected = isNotConnectedError(error);
  return (
    <UiErrorState
      title={notConnected ? `${title} — service not connected` : title}
      description={
        notConnected
          ? "This service has no adapter yet, so nothing can be loaded or saved. No data is invented in its place."
          : errorMessage(error)
      }
      {...(notConnected ? { reference: errorMessage(error) } : {})}
      {...(onRetry ? { onRetry } : {})}
      {...(size ? { size } : {})}
    />
  );
}

/** Content-shaped loading placeholder (skeleton, never a blocking spinner). */
export function LoadingSkeleton({
  label,
  rows = 4,
}: {
  readonly label: string;
  readonly rows?: number;
}): ReactElement {
  return (
    <SkeletonGroup label={label} className="grid gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-(--argus-row-h) w-full" />
      ))}
    </SkeletonGroup>
  );
}

/** Shown when no authenticated session scope exists, so no query is issued. */
export function SessionUnavailable(): ReactElement {
  return (
    <EmptyState
      size="page"
      icon={<CircleAlert />}
      title="No session scope available"
      description="Tenant, incident and position context are required before any data is requested. Nothing is loaded or shown until an authenticated session is provided."
    />
  );
}

export type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

/** Visible save state (saving / saved / conflict / failed): icon plus text, polite live region. */
export function SaveStatus({
  state,
  error,
}: {
  readonly state: SaveState;
  readonly error?: unknown;
}): ReactElement {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      {state === "saving" ? (
        <Badge tone="info" icon={<LoaderCircle className="motion-safe:animate-spin" />}>
          Saving…
        </Badge>
      ) : state === "saved" ? (
        <Badge tone="success" icon={<CircleCheck />}>
          Saved
        </Badge>
      ) : state === "conflict" ? (
        <Badge tone="warning" icon={<TriangleAlert />}>
          Conflict — newer version exists
        </Badge>
      ) : state === "error" ? (
        <Badge tone="critical" icon={<CircleAlert />}>
          Save failed{error === undefined || error === null ? "" : `: ${errorMessage(error)}`}
        </Badge>
      ) : null}
    </span>
  );
}
