import { type HTMLAttributes, type ReactElement, type ReactNode, useId } from "react";
import { cn } from "../lib/cn.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `raised` adds a soft shadow for cards that float over the canvas. */
  readonly elevation?: "flat" | "raised";
  /** Remove inner padding (e.g. when the body is a full-bleed table). */
  readonly flush?: boolean;
}

/** Bordered surface. Use for any grouped content on the canvas. */
export function Card({
  elevation = "flat",
  flush = false,
  className,
  ...props
}: CardProps): ReactElement {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface text-fg",
        elevation === "raised" && "shadow-sm",
        !flush && "p-(--argus-panel-p)",
        className,
      )}
      {...props}
    />
  );
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Heading text; also names the region for screen readers. */
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Right-aligned header controls (buttons, menus, filters). */
  readonly actions?: ReactNode;
  /** Status shown beside the title, e.g. a StatusPill or ConnectionIndicator. */
  readonly status?: ReactNode;
  readonly footer?: ReactNode;
  /** Heading level for document outline. Defaults to h2. */
  readonly headingLevel?: 2 | 3 | 4;
  /** Body without padding, for tables and maps. */
  readonly flush?: boolean;
  readonly bodyClassName?: string;
}

/**
 * Titled region: header (title, status, actions), body and optional footer. The standard
 * container for board blocks and page sections.
 */
export function Panel({
  title,
  description,
  actions,
  status,
  footer,
  headingLevel = 2,
  flush = false,
  className,
  bodyClassName,
  children,
  ...props
}: PanelProps): ReactElement {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col rounded-md border border-border bg-surface text-fg",
        className,
      )}
      {...props}
    >
      <header className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-(--argus-panel-p) py-2.5">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <Heading id={headingId} className="truncate text-md font-semibold text-fg">
              {title}
            </Heading>
            {status}
          </div>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1", !flush && "p-(--argus-panel-p)", bodyClassName)}>
        {children}
      </div>
      {footer ? (
        <footer className="flex items-center gap-2 border-t border-border px-(--argus-panel-p) py-2.5 text-sm text-fg-muted">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
