// biome-ignore-all lint/a11y/useSemanticElements: virtualized ARIA grid; native table markup cannot be windowed.
// biome-ignore-all lint/a11y/useFocusableInteractive: focus stays on the grid container (aria-activedescendant).
// biome-ignore-all lint/a11y/useKeyWithClickEvents: keyboard handling lives on the grid container.
import type { FieldDefinition, RecordEnvelope, ViewSort } from "@argus/schema";
import { cn, FlashOnChange } from "@argus/ui";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "@argus/ui/icons";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { PastedCell } from "./batch-model.js";
import { CellEditor } from "./cell-editor.js";
import { isFieldEditable } from "./field-catalog.js";
import { cellValue, type DisplayRow, formatCellValue } from "./grid-model.js";

export type PendingEditState = "saving" | "queued";
/** recordId -> fieldKey -> optimistic value shown until the server confirms. */
export type PendingEdits = ReadonlyMap<
  string,
  ReadonlyMap<string, { readonly value: unknown; readonly state: PendingEditState }>
>;

export interface DataGridProps {
  readonly caption: string;
  readonly tableId: string;
  readonly fields: readonly FieldDefinition[];
  readonly rows: readonly DisplayRow[];
  readonly pendingEdits: PendingEdits;
  readonly sorts: readonly ViewSort[];
  readonly rowHeight: number;
  readonly onSort: (fieldId: string, additive: boolean) => void;
  readonly onToggleGroup: (key: string) => void;
  readonly onEdit: (record: RecordEnvelope, field: FieldDefinition, next: unknown) => void;
  readonly onPasteCells: (cells: readonly PastedCell[], overflowRows: number) => void;
  readonly onUndo: () => void;
}

const HEADER_HEIGHT = 40;
const OVERSCAN = 8;
const COLUMN_WIDTH = 190;
const MIN_VIEWPORT = 320;

function sortDirection(
  sorts: readonly ViewSort[],
  fieldId: string,
): "ascending" | "descending" | "none" {
  return sorts.find((s) => s.fieldId === fieldId)?.direction ?? "none";
}

function isNumeric(field: FieldDefinition): boolean {
  return ["number", "currency", "percent", "duration"].includes(field.type);
}

/** Parses clipboard text (Excel/Sheets TSV) into a rectangular matrix. */
export function parseClipboardMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  return normalized === "" ? [] : normalized.split("\n").map((line) => line.split("\t"));
}

/**
 * Windowed spreadsheet grid. Only rows in (and just outside) the viewport are mounted, so 50k rows cost
 * the same as 50. Focus stays on the grid container (aria-activedescendant) so virtualization never drops it.
 * Keyboard: arrows move, Enter/F2 edit, Escape cancel, Home/End, PageUp/PageDown, Ctrl+Z undo, paste from Excel.
 */
export function DataGrid({
  caption,
  tableId,
  fields,
  rows,
  pendingEdits,
  sorts,
  rowHeight,
  onSort,
  onToggleGroup,
  onEdit,
  onPasteCells,
  onUndo,
}: DataGridProps): ReactElement {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(MIN_VIEWPORT);
  const [active, setActive] = useState({ row: 0, col: 0 });
  const [editing, setEditing] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => setViewport(Math.max(MIN_VIEWPORT, el.clientHeight)));
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setScrollTop(scrollerRef.current?.scrollTop ?? 0);
    });
  }, []);

  const lastRow = Math.max(0, rows.length - 1);
  const lastCol = Math.max(0, fields.length - 1);
  const activeRow = Math.min(active.row, lastRow);
  const activeCol = Math.min(active.col, lastCol);

  const ensureVisible = useCallback(
    (rowIndex: number) => {
      const el = scrollerRef.current;
      if (!el) {
        return;
      }
      const top = rowIndex * rowHeight;
      const bodyHeight = el.clientHeight - HEADER_HEIGHT;
      if (top < el.scrollTop) {
        el.scrollTop = top;
      } else if (top + rowHeight > el.scrollTop + bodyHeight) {
        el.scrollTop = top + rowHeight - bodyHeight;
      }
    },
    [rowHeight],
  );

  const move = (row: number, col: number): void => {
    const next = {
      row: Math.min(lastRow, Math.max(0, row)),
      col: Math.min(lastCol, Math.max(0, col)),
    };
    setActive(next);
    ensureVisible(next.row);
  };

  const startEdit = (): void => {
    const row = rows[activeRow];
    const field = fields[activeCol];
    if (row?.kind === "row" && field && isFieldEditable(field)) {
      setEditing(true);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (editing) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "z") {
      event.preventDefault();
      onUndo();
      return;
    }
    const page = Math.max(1, Math.floor((viewport - HEADER_HEIGHT) / rowHeight) - 1);
    switch (event.key) {
      case "ArrowDown":
        move(activeRow + 1, activeCol);
        break;
      case "ArrowUp":
        move(activeRow - 1, activeCol);
        break;
      case "ArrowRight":
        move(activeRow, activeCol + 1);
        break;
      case "ArrowLeft":
        move(activeRow, activeCol - 1);
        break;
      case "PageDown":
        move(activeRow + page, activeCol);
        break;
      case "PageUp":
        move(activeRow - page, activeCol);
        break;
      case "Home":
        move(event.ctrlKey ? 0 : activeRow, 0);
        break;
      case "End":
        move(event.ctrlKey ? lastRow : activeRow, lastCol);
        break;
      case "Enter":
      case "F2": {
        const row = rows[activeRow];
        if (row?.kind === "group") {
          onToggleGroup(row.key);
        } else {
          startEdit();
        }
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>): void => {
    if (editing) {
      return;
    }
    const matrix = parseClipboardMatrix(event.clipboardData.getData("text/plain"));
    if (matrix.length === 0) {
      return;
    }
    event.preventDefault();
    const records: RecordEnvelope[] = [];
    for (let i = activeRow; i < rows.length; i += 1) {
      const row = rows[i];
      if (row?.kind === "row") {
        records.push(row.record);
      }
    }
    const cells: PastedCell[] = [];
    matrix.forEach((line, r) => {
      const record = records[r];
      if (!record) {
        return;
      }
      line.forEach((raw, c) => {
        const field = fields[activeCol + c];
        if (field) {
          cells.push({ record, field, raw });
        }
      });
    });
    onPasteCells(cells, Math.max(0, matrix.length - records.length));
  };

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN);
  const totalWidth = Math.max(1, fields.length) * COLUMN_WIDTH;
  const cellId = (r: number, c: number): string => `${idPrefix}-r${r}c${c}`;

  const visible: ReactElement[] = [];
  for (let index = first; index < last; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    const style = { height: rowHeight, transform: `translateY(${index * rowHeight}px)` };
    if (row.kind === "group") {
      visible.push(
        <div
          key={`g:${row.key}`}
          role="row"
          aria-rowindex={index + 2}
          aria-expanded={!row.collapsed}
          className="absolute start-0 flex border-b border-border bg-surface-sunken font-semibold will-change-transform"
          style={{ ...style, width: totalWidth }}
        >
          <div
            role="gridcell"
            aria-colspan={Math.max(1, fields.length)}
            id={cellId(index, 0)}
            className={cn(
              "flex w-full items-center px-(--argus-cell-px)",
              index === activeRow && "outline-2 -outline-offset-2 outline-focus",
            )}
          >
            <button
              type="button"
              tabIndex={-1}
              className="flex items-center gap-1.5 text-start text-sm"
              onClick={() => {
                setActive({ row: index, col: 0 });
                onToggleGroup(row.key);
              }}
            >
              {row.collapsed ? (
                <ChevronRight aria-hidden="true" className="size-4" />
              ) : (
                <ChevronDown aria-hidden="true" className="size-4" />
              )}
              {row.label}
              <span className="font-mono text-xs font-normal text-fg-muted">({row.count})</span>
            </button>
          </div>
        </div>,
      );
      continue;
    }
    const record = row.record;
    visible.push(
      <div
        key={record.id}
        role="row"
        aria-rowindex={index + 2}
        className="absolute start-0 border-b border-border bg-surface will-change-transform hover:bg-surface-hover"
        style={{ ...style, width: totalWidth }}
        data-record-id={record.id}
      >
        <FlashOnChange as="div" value={record.version} className="flex h-full rounded-none">
          {fields.map((field, col) => {
            const pending = pendingEdits.get(record.id)?.get(field.key);
            const value = pending ? pending.value : cellValue(record, field);
            const isActive = index === activeRow && col === activeCol;
            const editable = isFieldEditable(field);
            const text = formatCellValue(field, value);
            return (
              <div
                key={field.id}
                role="gridcell"
                id={cellId(index, col)}
                aria-colindex={col + 1}
                aria-readonly={!editable}
                aria-selected={isActive}
                data-pending={pending?.state}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 overflow-hidden border-e border-border px-(--argus-cell-px) text-(length:--argus-cell-text)",
                  isNumeric(field) && "justify-end font-mono tabular-nums",
                  !editable && "text-fg-muted",
                  pending && "italic",
                  isActive && "outline-2 -outline-offset-2 outline-focus",
                )}
                style={{ width: COLUMN_WIDTH }}
                onClick={() => {
                  setEditing(false);
                  setActive({ row: index, col });
                }}
                onDoubleClick={() => {
                  setActive({ row: index, col });
                  if (editable) {
                    setEditing(true);
                  }
                }}
              >
                {isActive && editing && editable ? (
                  <CellEditor
                    field={field}
                    value={value}
                    tableId={tableId}
                    recordId={record.id}
                    onCancel={() => {
                      setEditing(false);
                      scrollerRef.current?.focus();
                    }}
                    onCommit={(next) => {
                      setEditing(false);
                      scrollerRef.current?.focus();
                      if (JSON.stringify(next) !== JSON.stringify(value)) {
                        onEdit(record, field, next);
                      }
                    }}
                  />
                ) : (
                  <>
                    <span className="truncate" title={text}>
                      {text}
                    </span>
                    {pending ? (
                      <span className="shrink-0 text-xs text-fg-subtle">
                        {pending.state === "saving" ? "Saving…" : "Queued offline"}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </FlashOnChange>
      </div>,
    );
  }

  const activeDescendant =
    rows.length > 0 && fields.length > 0 ? cellId(activeRow, activeCol) : undefined;

  return (
    <div
      ref={scrollerRef}
      className="relative h-[min(70vh,48rem)] min-h-80 overflow-auto bg-surface text-fg [contain:strict] focus-visible:outline-2 focus-visible:outline-focus"
      role="grid"
      aria-label={caption}
      aria-rowcount={rows.length + 1}
      aria-colcount={fields.length}
      aria-activedescendant={activeDescendant}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    >
      <div
        className="relative"
        style={{ width: totalWidth, height: HEADER_HEIGHT + rows.length * rowHeight }}
      >
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-(--argus-z-sticky) flex border-b border-border-strong bg-surface-sunken"
          style={{ height: HEADER_HEIGHT, width: totalWidth }}
        >
          {fields.map((field, col) => {
            const direction = sortDirection(sorts, field.id);
            return (
              <div
                key={field.id}
                role="columnheader"
                aria-colindex={col + 1}
                aria-sort={direction}
                className="flex shrink-0 items-center overflow-hidden border-e border-border px-(--argus-cell-px) text-xs font-semibold tracking-wide text-fg-muted uppercase"
                style={{ width: COLUMN_WIDTH }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className="flex w-full items-center gap-1 truncate rounded-sm text-start uppercase hover:text-fg"
                  onClick={(e) => onSort(field.id, e.shiftKey)}
                  title="Sort (Shift+click adds a secondary sort)"
                >
                  <span className="truncate">{field.name}</span>
                  {direction === "ascending" ? (
                    <ArrowUp aria-hidden="true" className="size-3.5 shrink-0 text-accent-text" />
                  ) : null}
                  {direction === "descending" ? (
                    <ArrowDown aria-hidden="true" className="size-3.5 shrink-0 text-accent-text" />
                  ) : null}
                  {direction !== "none" ? (
                    <span className="sr-only"> sorted {direction}</span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0" style={{ top: HEADER_HEIGHT }}>
          {visible}
        </div>
      </div>
    </div>
  );
}
