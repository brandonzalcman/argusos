import { Inbox, RotateCw, TriangleAlert } from "lucide-react";
import { type HTMLAttributes, type ReactElement, type ReactNode, useId } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";

export interface EmptyStateProps {
  /** What this area is and that it is empty, e.g. "No tasks assigned to your position". */
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Decorative icon; defaults to an inbox. */
  readonly icon?: ReactNode;
  /** The primary next action (and optionally a secondary one). */
  readonly action?: ReactNode;
  /** `inline` for inside panels and tables, `page` for whole routes. */
  readonly size?: "inline" | "page";
  readonly className?: string;
}

/** Explains an empty area and offers the next step. Never shows placeholder or fake rows. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  size = "inline",
  className,
}: EmptyStateProps): ReactElement {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center text-center",
        size === "page" ? "gap-3 py-16" : "gap-2 py-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-full border border-border bg-surface-sunken text-fg-muted",
          size === "page" ? "size-12 [&_svg]:size-6" : "size-10 [&_svg]:size-5",
        )}
      >
        {icon ?? <Inbox />}
      </span>
      <h2
        id={headingId}
        className={cn("font-semibold text-fg", size === "page" ? "text-lg" : "text-md")}
      >
        {title}
      </h2>
      {description ? <p className="text-base text-fg-muted text-pretty">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </section>
  );
}

export interface ErrorStateProps {
  /** What failed, in plain words: "Couldn't load incident tasks". */
  readonly title: ReactNode;
  /** Why/what to do next. Never include secrets or other tenants' data. */
  readonly description?: ReactNode;
  /** Retry handler; shows a "Try again" button. */
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  readonly retryLabel?: string;
  /** Support reference such as a correlation id, shown in monospace for copying. */
  readonly reference?: string;
  /** Extra actions beside retry. */
  readonly action?: ReactNode;
  readonly size?: "inline" | "page";
  readonly className?: string;
}

/** Explains a failure and how to recover. Announced politely so it doesn't interrupt. */
export function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  retryLabel = "Try again",
  reference,
  action,
  size = "inline",
  className,
}: ErrorStateProps): ReactElement {
  const headingId = useId();
  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby={headingId}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center text-center",
        size === "page" ? "gap-3 py-16" : "gap-2 py-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-full bg-critical-subtle text-critical",
          size === "page" ? "size-12 [&_svg]:size-6" : "size-10 [&_svg]:size-5",
        )}
      >
        <TriangleAlert />
      </span>
      <h2
        id={headingId}
        className={cn("font-semibold text-fg", size === "page" ? "text-lg" : "text-md")}
      >
        {title}
      </h2>
      {description ? <p className="text-base text-fg-muted text-pretty">{description}</p> : null}
      {reference ? (
        <p className="text-sm text-fg-muted">
          Reference: <code className="font-mono text-fg">{reference}</code>
        </p>
      ) : null}
      {onRetry || action ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button
              onClick={onRetry}
              loading={retrying}
              leadingIcon={<RotateCw aria-hidden="true" />}
            >
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </section>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** `text` renders a line at body-text height, `block` fills its given size. */
  readonly shape?: "block" | "text" | "circle";
}

/**
 * Loading placeholder for content (not a spinner). Purely decorative: wrap groups in
 * `SkeletonGroup` (or any `aria-busy` container with a label) so screen readers hear "loading".
 */
export function Skeleton({ shape = "block", className, ...props }: SkeletonProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-surface-hover motion-safe:animate-argus-pulse",
        shape === "text" && "h-3.5 rounded-sm",
        shape === "block" && "rounded-md",
        shape === "circle" && "rounded-full",
        className,
      )}
      {...props}
    />
  );
}

export interface SkeletonGroupProps {
  /** Announced to assistive tech, e.g. "Loading tasks". */
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Labeled busy region containing Skeletons. */
export function SkeletonGroup({ label, children, className }: SkeletonGroupProps): ReactElement {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Convenience: N skeleton text lines with a shorter last line. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  readonly lines?: number;
  readonly className?: string;
}): ReactElement {
  return (
    <div className={cn("grid gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          shape="text"
          className={index === lines - 1 && lines > 1 ? "w-3/5" : "w-full"}
        />
      ))}
    </div>
  );
}
