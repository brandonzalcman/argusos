import type { MenuDefinition, MenuItem, Position } from "@argus/schema";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  Textarea,
} from "@argus/ui";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  EyeOff,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Trash2,
} from "@argus/ui/icons";
import { type DragEvent, type ReactElement, useState } from "react";
import { useBoardList } from "../boards/queries.js";
import { ErrorState, LoadingSkeleton } from "../workflows/status-views.js";
import { useWorkflows } from "../workflows/workflow-queries.js";
import { useAdminSave, useMenu, usePositions } from "./admin-queries.js";
import {
  flattenMenu,
  indentMenuItem,
  isSafeMenuUrl,
  moveMenuItem,
  moveMenuItemRelative,
  outdentMenuItem,
  type PreviewedMenuItem,
  previewMenuForPosition,
  removeMenuItem,
  updateMenuItem,
} from "./definition-logic.js";
import { isDenied, PositionSelect, useBoardPreviews } from "./position-preview.js";
import { QueryGate } from "./query-gate.js";
import { DraftActions, DraftConflict, useDraft } from "./use-draft.js";

type LinkKind = MenuItem["type"];
const TYPE_LABEL: Readonly<Record<LinkKind, string>> = {
  section: "Section",
  board: "Board link",
  workflow: "Workflow link",
  page: "Page link",
  url: "URL link",
};
const ADDABLE: readonly LinkKind[] = ["section", "board", "workflow", "page", "url"];

interface TargetOption {
  readonly value: string;
  readonly label: string;
}

interface TargetSources {
  readonly boards: readonly TargetOption[];
  readonly workflows: readonly TargetOption[];
  readonly boardsError: unknown;
  readonly workflowsError: unknown;
  readonly loading: boolean;
}

/** Board and workflow link targets come from their own typed live queries (never invented). */
function useTargetSources(): TargetSources {
  const boards = useBoardList();
  const workflows = useWorkflows();
  return {
    boards: (boards.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    workflows: (workflows.data ?? []).map((w) => ({ value: w.id, label: w.name })),
    boardsError: boards.isError ? boards.error : null,
    workflowsError: workflows.isError ? workflows.error : null,
    loading: boards.isPending || workflows.isPending,
  };
}

type DropZone = "before" | "after" | "inside";

function zoneFor(event: DragEvent<HTMLElement>, item: MenuItem): DropZone {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = rect.height === 0 ? 0.5 : (event.clientY - rect.top) / rect.height;
  if (item.type === "section" && ratio > 0.3 && ratio < 0.7) return "inside";
  return ratio < 0.5 ? "before" : "after";
}

function TargetPicker({
  item,
  sources,
  onChange,
}: {
  readonly item: MenuItem;
  readonly sources: TargetSources;
  readonly onChange: (patch: Partial<MenuItem>) => void;
}): ReactElement | null {
  if (item.type === "url") {
    const invalid = item.url !== null && !isSafeMenuUrl(item.url);
    return (
      <Field
        label="URL"
        description="Only http, https and mailto links are allowed."
        {...(invalid ? { error: "This URL is not allowed." } : {})}
      >
        <Input
          mono
          value={item.url ?? ""}
          onChange={(event) =>
            onChange({ url: event.target.value === "" ? null : event.target.value })
          }
        />
      </Field>
    );
  }
  if (item.type === "board" || item.type === "workflow") {
    const options = item.type === "board" ? sources.boards : sources.workflows;
    const error = item.type === "board" ? sources.boardsError : sources.workflowsError;
    const noun = item.type === "board" ? "boards" : "workflows";
    return (
      <Field
        label={item.type === "board" ? "Board" : "Workflow"}
        {...(error
          ? { error: `Couldn't load ${noun}; the current target is kept as is.` }
          : options.length === 0 && !sources.loading
            ? { description: `No ${noun} are available to link.` }
            : {})}
      >
        <Select
          value={item.targetId ?? ""}
          placeholder={`Choose a ${item.type}…`}
          options={
            item.targetId && !options.some((o) => o.value === item.targetId)
              ? [
                  ...options,
                  { value: item.targetId, label: `Unknown (${item.targetId.slice(0, 8)}…)` },
                ]
              : options
          }
          onValueChange={(targetId) => onChange({ targetId })}
        />
      </Field>
    );
  }
  if (item.type === "page") {
    return (
      <Field
        label="Page ID"
        description="User-built page. TODO(implementation): a page picker once the studio exposes a page list."
      >
        <Input
          mono
          value={item.targetId ?? ""}
          onChange={(event) =>
            onChange({ targetId: event.target.value === "" ? null : event.target.value })
          }
        />
      </Field>
    );
  }
  return null;
}

function MenuRow({
  item,
  depth,
  positions,
  sources,
  dragId,
  dropHint,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDropRow,
  onChange,
  onMove,
  onIndent,
  onOutdent,
  onRequestRemove,
}: {
  readonly item: MenuItem;
  readonly depth: number;
  readonly positions: readonly Position[];
  readonly sources: TargetSources;
  readonly dragId: string | null;
  readonly dropHint: DropZone | null;
  readonly onDragStart: (event: DragEvent<HTMLElement>) => void;
  readonly onDragEnd: () => void;
  readonly onDragOverRow: (event: DragEvent<HTMLElement>) => void;
  readonly onDropRow: (event: DragEvent<HTMLElement>) => void;
  readonly onChange: (patch: Partial<MenuItem>) => void;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onIndent: () => void;
  readonly onOutdent: () => void;
  readonly onRequestRemove: () => void;
}): ReactElement {
  const label = item.label || TYPE_LABEL[item.type];
  return (
    <li
      style={{ marginInlineStart: `${depth * 1.5}rem` }}
      onDragOver={onDragOverRow}
      onDrop={onDropRow}
      className={cn(
        "rounded-md border border-border bg-surface p-3 shadow-sm",
        dragId === item.id && "opacity-50",
        dropHint === "before" && "border-t-2 border-t-accent",
        dropHint === "after" && "border-b-2 border-b-accent",
        dropHint === "inside" && "bg-accent-subtle ring-2 ring-accent",
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onKeyDown={(event) => {
            if (event.altKey && event.key === "ArrowUp") {
              event.preventDefault();
              onMove(-1);
            } else if (event.altKey && event.key === "ArrowDown") {
              event.preventDefault();
              onMove(1);
            }
          }}
          aria-label={`Reorder ${label}: drag, or press Alt+Up or Alt+Down`}
          title="Drag to reorder (or Alt+Up / Alt+Down)"
          className="mt-0.5 inline-flex h-(--argus-control-h) w-8 cursor-grab items-center justify-center rounded-sm text-fg-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus active:cursor-grabbing"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <div className="grid min-w-48 flex-1 gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Label" description={TYPE_LABEL[item.type]}>
              <Input
                value={item.label}
                onChange={(event) => onChange({ label: event.target.value })}
              />
            </Field>
            <TargetPicker item={item} sources={sources} onChange={onChange} />
          </div>
          <details className="rounded-sm border border-border bg-surface-sunken px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-fg focus-visible:outline-2 focus-visible:outline-focus">
              Visibility:{" "}
              {item.positionIds.length === 0
                ? "all positions"
                : `${item.positionIds.length} ${item.positionIds.length === 1 ? "position" : "positions"}`}
              {item.visibilityExpression ? " + CEL rule" : ""}
            </summary>
            <div className="mt-3 grid gap-3">
              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-sm text-fg-muted">
                  Visible to positions (none selected means everyone)
                </legend>
                {positions.map((position) => (
                  <Checkbox
                    key={position.id}
                    label={position.name}
                    checked={item.positionIds.includes(position.id)}
                    onCheckedChange={(checked) =>
                      onChange({
                        positionIds:
                          checked === true
                            ? [...item.positionIds, position.id]
                            : item.positionIds.filter((p) => p !== position.id),
                      })
                    }
                  />
                ))}
              </fieldset>
              <Field
                label="Visibility expression (CEL, optional)"
                description="Evaluated by the server only; the preview below does not apply it."
              >
                <Textarea
                  rows={2}
                  spellCheck={false}
                  className="font-mono"
                  value={item.visibilityExpression ?? ""}
                  onChange={(event) =>
                    onChange({
                      visibilityExpression: event.target.value === "" ? null : event.target.value,
                    })
                  }
                />
              </Field>
            </div>
          </details>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: toolbar-style group of icon buttons, not a form fieldset */}
        <div className="flex flex-wrap gap-1" role="group" aria-label={`Actions for ${label}`}>
          <IconButton label={`Move ${label} up`} icon={<ArrowUp />} onClick={() => onMove(-1)} />
          <IconButton label={`Move ${label} down`} icon={<ArrowDown />} onClick={() => onMove(1)} />
          <IconButton
            label={`Nest ${label} under the section above`}
            icon={<IndentIncrease />}
            onClick={onIndent}
          />
          <IconButton
            label={`Move ${label} out of its section`}
            icon={<IndentDecrease />}
            onClick={onOutdent}
          />
          <IconButton label={`Remove ${label}`} icon={<Trash2 />} onClick={onRequestRemove} />
        </div>
      </div>
    </li>
  );
}

function PreviewTree({ nodes }: { readonly nodes: readonly PreviewedMenuItem[] }): ReactElement {
  return (
    <ul className="grid gap-1 ps-4">
      {nodes.map(({ item, visible, children }) => (
        <li key={item.id} className="text-base">
          {visible ? (
            <>
              <span className="font-medium text-fg">{item.label}</span>{" "}
              <span className="text-sm text-fg-muted">{TYPE_LABEL[item.type]}</span>
              {children.length > 0 ? <PreviewTree nodes={children} /> : null}
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-fg-muted">
              <s>{item.label}</s>
              <Badge tone="neutral" variant="outline" icon={<EyeOff />}>
                Hidden for this position
              </Badge>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function MenuEditor({
  menu,
  positions,
}: {
  readonly menu: MenuDefinition;
  readonly positions: readonly Position[];
}): ReactElement {
  const save = useAdminSave<MenuDefinition, MenuDefinition>("menu", (service, request) =>
    service.saveMenu({
      scope: request.session.scope,
      actor: request.session.actor,
      expectedVersion: request.expectedVersion,
      definition: request.definition,
    }),
  );
  const controller = useDraft(menu, (expectedVersion, definition) =>
    save.mutateAsync({ expectedVersion, definition }),
  );
  const { draft, edit } = controller;
  const sources = useTargetSources();
  const [previewPosition, setPreviewPosition] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ id: string; zone: DropZone } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const flat = flattenMenu(draft.items);
  const boardTargets = flat
    .filter(({ item }) => item.type === "board" && item.targetId !== null)
    .map(({ item }) => ({ itemId: item.id, boardId: item.targetId as string }));
  const previews = useBoardPreviews(
    previewPosition,
    boardTargets.map((t) => ({ boardId: t.boardId, definitionVersion: draft.version })),
  );
  const denied = new Set<string>();
  boardTargets.forEach((target, index) => {
    if (isDenied(previews[index]?.data)) denied.add(target.itemId);
  });
  const firstPreviewError = previews.find((p) => p.isError)?.error;
  const previewTree = previewPosition
    ? previewMenuForPosition(draft.items, previewPosition, denied)
    : null;

  const apply = (items: MenuItem[], message: string): void => {
    edit((current) => ({ ...current, items }));
    setAnnouncement(message);
  };

  const position = (id: string, items: readonly MenuItem[]): string => {
    const index = flattenMenu(items).findIndex((f) => f.item.id === id);
    return `position ${index + 1} of ${flattenMenu(items).length}`;
  };

  const addItem = (type: LinkKind): void =>
    edit((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: crypto.randomUUID(),
          type,
          label: type === "section" ? "New section" : "New link",
          targetId: null,
          url: type === "url" ? "https://" : null,
          icon: null,
          positionIds: [],
          visibilityExpression: null,
          children: [],
        },
      ],
    }));

  const removable = flat.find((f) => f.item.id === removing)?.item;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Menus"
        description="Ordered, position-filtered side menus. Hiding an item is a UX filter; targets are still authorized by the server."
        actions={<DraftActions controller={controller} />}
      />
      <DraftConflict
        controller={controller}
        recordLabel={draft.name}
        describe={(mine, theirs) => [
          {
            fieldId: "items",
            fieldLabel: "Menu items",
            localValue: `${flattenMenu(mine.items).length} items`,
            serverValue: `${flattenMenu(theirs.items).length} items`,
          },
        ]}
      />
      <ConfirmDialog
        open={removable !== undefined}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Remove menu item?"
        itemName={removable?.label ?? ""}
        description={
          removable && removable.children.length > 0
            ? "Its nested items are removed with it. Unsaved edits can still be discarded by reloading."
            : "It is removed from the draft menu."
        }
        confirmLabel="Remove item"
        destructive
        onConfirm={() => {
          if (removing) apply(removeMenuItem(draft.items, removing), "Menu item removed.");
          setRemoving(null);
        }}
      />
      <div className="grid items-start gap-(--argus-gap) xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <Panel
          title="Menu items"
          description="Drag a handle to reorder; drop on a section's middle to nest. Keyboard: Alt+Up/Down on the handle, or the buttons."
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  leadingIcon={<Plus aria-hidden="true" />}
                  trailingIcon={<ChevronDown aria-hidden="true" />}
                >
                  Add item
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ADDABLE.map((type) => (
                  <DropdownMenuItem key={type} onSelect={() => addItem(type)}>
                    {TYPE_LABEL[type]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
          bodyClassName="grid gap-3"
        >
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
          {draft.items.length === 0 ? (
            <EmptyState
              title="This menu has no items"
              description="Add a section, a board, page or workflow link, or a URL."
            />
          ) : (
            <ol className="grid gap-2">
              {flat.map(({ item, depth }) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  depth={depth}
                  positions={positions}
                  sources={sources}
                  dragId={dragId}
                  dropHint={hint?.id === item.id ? hint.zone : null}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                    setDragId(item.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setHint(null);
                  }}
                  onDragOverRow={(event) => {
                    if (!dragId || dragId === item.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    const zone = zoneFor(event, item);
                    if (hint?.id !== item.id || hint.zone !== zone) setHint({ id: item.id, zone });
                  }}
                  onDropRow={(event) => {
                    event.preventDefault();
                    if (dragId && hint && hint.id === item.id) {
                      const items = moveMenuItemRelative(draft.items, dragId, item.id, hint.zone);
                      apply(items, `Moved ${position(dragId, items)}.`);
                    }
                    setDragId(null);
                    setHint(null);
                  }}
                  onChange={(patch) =>
                    edit((c) => ({ ...c, items: updateMenuItem(c.items, item.id, patch) }))
                  }
                  onMove={(delta) => {
                    const items = moveMenuItem(draft.items, item.id, delta);
                    apply(items, `Moved ${item.label} to ${position(item.id, items)}.`);
                  }}
                  onIndent={() => {
                    const items = indentMenuItem(draft.items, item.id);
                    apply(items, `Nested ${item.label}.`);
                  }}
                  onOutdent={() => {
                    const items = outdentMenuItem(draft.items, item.id);
                    apply(items, `Moved ${item.label} out of its section.`);
                  }}
                  onRequestRemove={() => setRemoving(item.id)}
                />
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Visibility preview" bodyClassName="grid gap-3">
          <PositionSelect
            positions={positions}
            value={previewPosition}
            onChange={setPreviewPosition}
          />
          {previewTree === null ? (
            <p className="text-base text-fg-muted">Choose a position to see its menu.</p>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                Items use each position list; board links the server denies are hidden too. CEL
                rules are evaluated by the server only and are not applied here.
              </p>
              {previews.some((p) => p.isFetching) ? (
                <LoadingSkeleton label="Evaluating server policy" rows={1} />
              ) : null}
              {firstPreviewError ? (
                <ErrorState
                  title="Server policy preview unavailable"
                  error={firstPreviewError}
                  size="inline"
                />
              ) : null}
              <PreviewTree nodes={previewTree} />
            </>
          )}
        </Panel>
      </div>
    </PageContainer>
  );
}

/**
 * Menu admin (/admin/menus): ordered side-menu definition with drag-and-drop reordering and a
 * keyboard fallback, board/workflow/page/URL link targets, and per-position visibility preview.
 */
export function MenuAdminScreen(): ReactElement {
  const menuQuery = useMenu();
  const positionsQuery = usePositions();
  return (
    <QueryGate
      query={positionsQuery}
      noun="positions"
      title="Menus"
      description="Ordered, position-filtered side menus."
      emptyDescription="Positions are required to preview menus."
    >
      {(positions) => (
        <QueryGate
          query={menuQuery}
          noun="menu"
          title="Menus"
          description="Ordered, position-filtered side menus."
          emptyDescription="No menu definition exists yet. Creating one requires the menu API (TODO(implementation))."
        >
          {(menu) => <MenuEditor key={menu.id} menu={menu} positions={positions} />}
        </QueryGate>
      )}
    </QueryGate>
  );
}
