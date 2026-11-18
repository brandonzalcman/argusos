import { ChevronRight } from "lucide-react";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface BreadcrumbItem {
  readonly label: string;
  /** Rendered link element (e.g. a router Link). Omit for the current page. */
  readonly link?: ReactNode;
}

export interface PageHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Small label above the title, e.g. the section or record type. */
  readonly eyebrow?: ReactNode;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  /** Primary/secondary page actions, right-aligned on wide screens. */
  readonly actions?: ReactNode;
  /** Status/metadata row below the title (status pills, last-updated time, presence). */
  readonly meta?: ReactNode;
  readonly className?: string;
}

/** The single h1 of a route, with optional breadcrumbs, metadata and actions. */
export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
  meta,
  className,
}: PageHeaderProps): ReactElement {
  return (
    <header className={cn("grid gap-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <Fragment key={crumb.label}>
                  <li
                    className={cn(last && "font-medium text-fg")}
                    aria-current={last ? "page" : undefined}
                  >
                    {crumb.link && !last ? crumb.link : crumb.label}
                  </li>
                  {last ? null : (
                    <li aria-hidden="true">
                      <ChevronRight className="size-3.5 rtl:rotate-180" />
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 max-w-3xl gap-1">
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-wider text-fg-muted uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-fg text-balance">{title}</h1>
          {description ? <p className="text-md text-fg-muted text-pretty">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">{meta}</div>
      ) : null}
    </header>
  );
}
