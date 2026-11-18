import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type {
  HTMLAttributes,
  ReactElement,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "../lib/cn.js";
import { focusRingInset } from "../lib/focus.js";

/*
 * Semantic table primitives for small/medium record lists (< ~500 rows). Large live grids use
 * the canvas data grid (TODO(implementation): Glide Data Grid adapter in a later slice) with the
 * same tokens. Row height and cell padding follow the density tokens.
 */

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Max height before the body scrolls under the sticky header. */
  readonly maxHeight?: string;
}

/** Scroll container with border; keeps the header sticky while the body scrolls. */
export function TableContainer({
  maxHeight,
  className,
  style,
  ...props
}: TableContainerProps): ReactElement {
  return (
    <div
      className={cn(
        "relative w-full overflow-auto rounded-md border border-border bg-surface",
        className,
      )}
      style={maxHeight ? { maxHeight, ...style } : style}
      {...props}
    />
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>): ReactElement {
  return (
    <table
      className={cn(
        "w-full border-separate border-spacing-0 text-(length:--argus-cell-text) tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement>): ReactElement {
  return (
    <caption
      className={cn("px-(--argus-cell-px) py-2 text-start text-sm text-fg-muted", className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): ReactElement {
  return (
    <thead
      className={cn("sticky top-0 z-(--argus-z-sticky) bg-surface-sunken", className)}
      {...props}
    />
  );
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>): ReactElement {
  return <tbody {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  readonly selected?: boolean;
  /** Highlight briefly after a live update (pair with FlashOnChange for motion). */
  readonly highlighted?: boolean;
  readonly interactive?: boolean;
}

export function TableRow({
  selected = false,
  highlighted = false,
  interactive = false,
  className,
  ...props
}: TableRowProps): ReactElement {
  return (
    <tr
      aria-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
      className={cn(
        "group/row transition-colors duration-(--argus-duration-slow)",
        interactive && "cursor-pointer hover:bg-surface-hover",
        selected && "bg-accent-subtle hover:bg-accent-subtle",
        highlighted && "bg-info-subtle",
        focusRingInset,
        className,
      )}
      {...props}
    />
  );
}

export type SortDirection = "ascending" | "descending" | "none";

export interface TableHeadProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  readonly align?: "start" | "end" | "center";
  /** Makes the header a sort button and sets `aria-sort`. */
  readonly sort?: SortDirection;
  readonly onSort?: () => void;
}

export function TableHead({
  align = "start",
  sort,
  onSort,
  className,
  children,
  ...props
}: TableHeadProps): ReactElement {
  const SortIcon =
    sort === "ascending" ? ArrowUp : sort === "descending" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={sort && sort !== "none" ? sort : undefined}
      className={cn(
        "h-(--argus-row-h) border-b border-border px-(--argus-cell-px) text-xs font-semibold tracking-wide whitespace-nowrap text-fg-muted uppercase",
        align === "start" && "text-start",
        align === "end" && "text-end",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 uppercase hover:text-fg",
            focusRingInset,
            sort && sort !== "none" && "text-fg",
          )}
        >
          {children}
          <SortIcon
            aria-hidden="true"
            className={cn("size-3.5", (!sort || sort === "none") && "opacity-50")}
          />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  readonly align?: "start" | "end" | "center";
  /** Monospace for ids, coordinates and times. */
  readonly mono?: boolean;
  readonly muted?: boolean;
}

export function TableCell({
  align = "start",
  mono = false,
  muted = false,
  className,
  ...props
}: TableCellProps): ReactElement {
  return (
    <td
      className={cn(
        "h-(--argus-row-h) border-b border-border px-(--argus-cell-px) align-middle text-fg group-last/row:border-b-0",
        align === "end" && "text-end",
        align === "center" && "text-center",
        mono && "font-mono text-sm",
        muted && "text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export interface TableStateRowProps {
  readonly colSpan: number;
  /** EmptyState, ErrorState or skeleton rows. */
  readonly children: ReactNode;
}

/** Full-width row for empty, error and loading states inside a table body. */
export function TableStateRow({ colSpan, children }: TableStateRowProps): ReactElement {
  return (
    <tr>
      <td colSpan={colSpan} className="px-(--argus-cell-px)">
        {children}
      </td>
    </tr>
  );
}
