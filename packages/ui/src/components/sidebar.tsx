import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Slot } from "radix-ui";
import { cloneElement, type ReactElement, type ReactNode, useId } from "react";
import { cn } from "../lib/cn.js";
import { focusRing } from "../lib/focus.js";
import { useAppShell } from "./app-shell.js";
import { IconButton } from "./icon-button.js";
import { Tooltip } from "./tooltip.js";

/** ArgusOS mark: a stylised watchful eye. Decorative; pair with the product name. */
export function ArgusMark({ className }: { readonly className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" fill="var(--argus-color-accent)" />
      <path
        d="M5.5 16c2.8-4.6 6.3-7 10.5-7s7.7 2.4 10.5 7c-2.8 4.6-6.3 7-10.5 7s-7.7-2.4-10.5-7Z"
        fill="none"
        stroke="var(--argus-color-on-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="3.25" fill="var(--argus-color-on-accent)" />
    </svg>
  );
}

export interface SidebarProps {
  /** Product/tenant name; tenants may replace the mark with their logo. */
  readonly brand?: ReactNode;
  /** Replaces the ArgusOS mark (tenant logo). */
  readonly logo?: ReactNode;
  /** Navigation content: SidebarSection elements. */
  readonly children: ReactNode;
  /** Pinned bottom area (settings, user/position). */
  readonly footer?: ReactNode;
  readonly "aria-label"?: string;
}

/** Sidebar column: brand row with collapse toggle, scrollable navigation, pinned footer. */
export function Sidebar({
  brand = "ArgusOS",
  logo,
  children,
  footer,
  "aria-label": ariaLabel = "Primary navigation",
}: SidebarProps): ReactElement {
  const { collapsed, setCollapsed, inDrawer } = useAppShell();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex h-(--argus-topbar-h) shrink-0 items-center gap-2.5 border-b border-border",
          collapsed ? "justify-center px-2" : "px-3.5",
        )}
      >
        {logo ?? <ArgusMark />}
        {collapsed ? null : (
          <span className="min-w-0 flex-1 truncate text-md font-semibold tracking-tight text-fg">
            {brand}
          </span>
        )}
        {inDrawer || collapsed ? null : (
          <IconButton
            label="Collapse sidebar"
            icon={<PanelLeftClose />}
            size="sm"
            className="text-fg-muted"
            onClick={() => setCollapsed(true)}
            tooltipSide="right"
          />
        )}
      </div>
      <nav
        aria-label={ariaLabel}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3"
      >
        <div className="grid gap-5">{children}</div>
      </nav>
      {footer || collapsed ? (
        <div className="grid shrink-0 gap-1 border-t border-border px-2 py-2.5">
          {footer}
          {collapsed && !inDrawer ? (
            <div className="flex justify-center">
              <IconButton
                label="Expand sidebar"
                icon={<PanelLeftOpen />}
                size="sm"
                className="text-fg-muted"
                onClick={() => setCollapsed(false)}
                tooltipSide="right"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface SidebarSectionProps {
  /** Group heading, e.g. "Operate", "Build", "Administer". */
  readonly title?: string;
  readonly children: ReactNode;
}

export function SidebarSection({ title, children }: SidebarSectionProps): ReactElement {
  const { collapsed } = useAppShell();
  const headingId = useId();
  return (
    <section aria-labelledby={title ? headingId : undefined} className="grid gap-0.5">
      {title ? (
        <h2
          id={headingId}
          className={cn(
            "px-2.5 pb-1 text-xs font-semibold tracking-wider text-fg-subtle uppercase",
            collapsed && "sr-only",
          )}
        >
          {title}
        </h2>
      ) : null}
      {collapsed && title ? (
        <div aria-hidden="true" className="mx-2.5 mb-1 h-px bg-border first:hidden" />
      ) : null}
      <ul className="grid gap-0.5">{children}</ul>
    </section>
  );
}

export interface SidebarItemProps {
  readonly icon: ReactNode;
  readonly label: string;
  /**
   * The link element (e.g. TanStack `<Link to="/incidents" />`), styled via Slot. Active state
   * is read from `aria-current="page"` or `data-status="active"` that routers set.
   */
  readonly children: ReactElement;
  /** Force the active style when the router cannot express it. */
  readonly active?: boolean;
  /** Small trailing count or status (e.g. unread alerts). Hidden when collapsed. */
  readonly badge?: ReactNode;
}

/** One navigation entry with icon, label, active highlight and collapsed-mode tooltip. */
export function SidebarItem({
  icon,
  label,
  children,
  active,
  badge,
}: SidebarItemProps): ReactElement {
  const { collapsed } = useAppShell();
  const content = (
    <>
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
      {collapsed ? null : <span className="min-w-0 flex-1 truncate">{label}</span>}
      {collapsed || !badge ? null : <span className="ms-auto">{badge}</span>}
    </>
  );
  const link = (
    <Slot.Root
      data-active={active || undefined}
      className={cn(
        "group/item relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-base font-medium text-fg-muted no-underline",
        "transition-colors duration-(--argus-duration-fast)",
        "hover:bg-surface-hover hover:text-fg",
        "aria-[current=page]:bg-accent-subtle aria-[current=page]:text-accent-text",
        "data-[status=active]:bg-accent-subtle data-[status=active]:text-accent-text",
        "data-active:bg-accent-subtle data-active:text-accent-text",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        collapsed && "justify-center px-0",
        focusRing,
      )}
      {...(collapsed ? { "aria-label": label } : {})}
    >
      {cloneElement(children, undefined, content)}
    </Slot.Root>
  );
  return (
    <li>
      {collapsed ? (
        <Tooltip content={label} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}
