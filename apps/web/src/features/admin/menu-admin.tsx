import type { MenuDefinition, MenuItem, Position } from "@argus/schema";
import { type ReactElement, useId, useState } from "react";
import { ErrorState, LoadingSkeleton, PageHeader } from "../workflows/status-views.js";
import { useAdminSave, useMenu, usePositions } from "./admin-queries.js";
import {
  flattenMenu,
  isSafeMenuUrl,
  moveMenuItem,
  type PreviewedMenuItem,
  previewMenuForPosition,
  removeMenuItem,
  updateMenuItem,
} from "./definition-logic.js";
import { isDenied, PositionSelect, useBoardPreviews } from "./position-preview.js";
import { QueryGate } from "./query-gate.js";
import { DraftToolbar, useDraft } from "./use-draft.js";

function MenuItemRow({
  item,
  depth,
  positions,
  onChange,
  onMove,
  onRemove,
}: {
  readonly item: MenuItem;
  readonly depth: number;
  readonly positions: readonly Position[];
  readonly onChange: (patch: Partial<MenuItem>) => void;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onRemove: () => void;
}): ReactElement {
  const id = useId();
  return (
    <li style={{ marginInlineStart: `${depth * 1.5}rem` }} className="argus-panel">
      <div className="argus-cluster">
        <label htmlFor={`${id}-label`}>Label</label>
        <input
          id={`${id}-label`}
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <span className="argus-muted">{item.type}</span>
        <button type="button" aria-label={`Move ${item.label} up`} onClick={() => onMove(-1)}>
          ↑ Up
        </button>
        <button type="button" aria-label={`Move ${item.label} down`} onClick={() => onMove(1)}>
          ↓ Down
        </button>
        <button type="button" aria-label={`Remove ${item.label}`} onClick={onRemove}>
          Remove
        </button>
      </div>
      {item.type === "url" ? (
        <div>
          <label htmlFor={`${id}-url`}>URL</label>{" "}
          <input
            id={`${id}-url`}
            value={item.url ?? ""}
            aria-invalid={item.url !== null && !isSafeMenuUrl(item.url) ? true : undefined}
            onChange={(e) => onChange({ url: e.target.value === "" ? null : e.target.value })}
          />
          {item.url !== null && !isSafeMenuUrl(item.url) ? (
            <span role="alert" style={{ color: "var(--argus-color-danger)" }}>
              {" "}
              ✕ Only http, https and mailto links are allowed.
            </span>
          ) : null}
        </div>
      ) : null}
      <fieldset>
        <legend>Visible to positions (none selected = everyone)</legend>
        {positions.map((position) => (
          <label key={position.id} style={{ marginInlineEnd: "1rem" }}>
            <input
              type="checkbox"
              checked={item.positionIds.includes(position.id)}
              onChange={(e) =>
                onChange({
                  positionIds: e.target.checked
                    ? [...item.positionIds, position.id]
                    : item.positionIds.filter((p) => p !== position.id),
                })
              }
            />{" "}
            {position.name}
          </label>
        ))}
      </fieldset>
    </li>
  );
}

function PreviewTree({ nodes }: { readonly nodes: readonly PreviewedMenuItem[] }): ReactElement {
  return (
    <ul>
      {nodes.map(({ item, visible, children }) => (
        <li key={item.id}>
          {visible ? (
            <>
              {item.label}
              {children.length > 0 ? <PreviewTree nodes={children} /> : null}
            </>
          ) : (
            <span className="argus-muted">
              <s>{item.label}</s> — hidden for this position
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
  const [previewPosition, setPreviewPosition] = useState<string | null>(null);

  const boardTargets = flattenMenu(draft.items)
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

  const addItem = (type: MenuItem["type"]): void =>
    edit((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: crypto.randomUUID(),
          type,
          label: type === "section" ? "New section" : "New item",
          targetId: null,
          url: type === "url" ? "https://" : null,
          icon: null,
          positionIds: [],
          visibilityExpression: null,
          children: [],
        },
      ],
    }));

  return (
    <div className="argus-stack">
      <DraftToolbar controller={controller} />
      <section className="argus-panel" aria-labelledby="menu-items-heading">
        <h2 id="menu-items-heading" style={{ marginTop: 0 }}>
          Menu items
        </h2>
        {draft.items.length === 0 ? (
          <p className="argus-muted">This menu has no items. Add a section, board link or URL.</p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0 }} className="argus-stack">
            {flattenMenu(draft.items).map(({ item, depth }) => (
              <MenuItemRow
                key={item.id}
                item={item}
                depth={depth}
                positions={positions}
                onChange={(patch) =>
                  edit((c) => ({ ...c, items: updateMenuItem(c.items, item.id, patch) }))
                }
                onMove={(delta) =>
                  edit((c) => ({ ...c, items: moveMenuItem(c.items, item.id, delta) }))
                }
                onRemove={() => edit((c) => ({ ...c, items: removeMenuItem(c.items, item.id) }))}
              />
            ))}
          </ol>
        )}
        <div className="argus-cluster">
          <button type="button" onClick={() => addItem("section")}>
            Add section
          </button>
          <button type="button" onClick={() => addItem("url")}>
            Add URL link
          </button>
          <span className="argus-muted">
            Board and workflow links need a target picker (TODO(implementation)).
          </span>
        </div>
      </section>

      <section className="argus-panel" aria-labelledby="menu-preview-heading">
        <h2 id="menu-preview-heading" style={{ marginTop: 0 }}>
          Visibility preview
        </h2>
        <PositionSelect
          positions={positions}
          value={previewPosition}
          onChange={setPreviewPosition}
        />
        {previewTree === null ? (
          <p className="argus-muted">Choose a position to see its menu.</p>
        ) : (
          <>
            <p className="argus-muted">
              Hidden items use each item’s position list; board links the server denies are hidden
              too. CEL visibility expressions are evaluated only by the server and are not applied
              here.
            </p>
            {previews.some((p) => p.isPending && p.fetchStatus !== "idle") ? (
              <LoadingSkeleton label="Evaluating server policy" />
            ) : null}
            {firstPreviewError ? (
              <ErrorState title="Server policy preview unavailable" error={firstPreviewError} />
            ) : null}
            <PreviewTree nodes={previewTree} />
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Menu admin (/admin/menus): ordered side-menu definition with keyboard-operable reordering and
 * per-position visibility preview (position filter plus server authorization preview).
 */
export function MenuAdminScreen(): ReactElement {
  const menuQuery = useMenu();
  const positionsQuery = usePositions();
  return (
    <article className="argus-stack">
      <PageHeader
        title="Menus"
        description="Ordered, position-filtered side menus. Hiding an item is a UX filter; targets are still authorized by the server."
      />
      <QueryGate
        query={positionsQuery}
        noun="positions"
        emptyDescription="Positions are required to preview menus."
      >
        {(positions) => (
          <QueryGate
            query={menuQuery}
            noun="menu"
            emptyDescription="No menu definition exists yet. Creating one requires the menu API (TODO(implementation))."
          >
            {(menu) => <MenuEditor key={menu.id} menu={menu} positions={positions} />}
          </QueryGate>
        )}
      </QueryGate>
    </article>
  );
}
