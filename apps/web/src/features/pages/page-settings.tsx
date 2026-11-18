import type { PageDefinition, Position } from "@argus/schema";
import { Checkbox, Field, Input, Textarea } from "@argus/ui";
import { type ReactElement, useId } from "react";
import { knownPageIconNames } from "./page-icon.js";
import { pageUrlPath, validatePageSlug } from "./page-slug.js";

export type PageEdit = (
  next: PageDefinition,
  options?: { key?: string; announce?: string },
) => void;

export interface PageSettingsProps {
  readonly page: PageDefinition;
  /** Positions the signed-in user can act as; used to label position ids. */
  readonly positions: readonly Pick<Position, "id" | "name">[];
  readonly editable: boolean;
  readonly onEdit: PageEdit;
}

function PositionChecklist({
  legend,
  description,
  selected,
  positions,
  disabled,
  onChange,
}: {
  readonly legend: string;
  readonly description: string;
  readonly selected: readonly string[];
  readonly positions: readonly Pick<Position, "id" | "name">[];
  readonly disabled: boolean;
  readonly onChange: (next: string[]) => void;
}): ReactElement {
  const known = new Set(positions.map((position) => position.id));
  // Ids already on the page that this session can't name stay visible so saving never drops them.
  const unknown = selected.filter((id) => !known.has(id));
  const rows = [
    ...positions.map((position) => ({ id: position.id, label: position.name })),
    ...unknown.map((id) => ({ id, label: `Another position (${id.slice(0, 8)}…)` })),
  ];
  const toggle = (id: string, checked: boolean): string[] =>
    checked ? [...new Set([...selected, id])] : selected.filter((value) => value !== id);
  return (
    <fieldset className="grid gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium text-fg">{legend}</legend>
      <p className="text-xs text-fg-muted">{description}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">No positions available in this session.</p>
      ) : (
        rows.map((row) => (
          <Checkbox
            key={row.id}
            label={row.label}
            checked={selected.includes(row.id)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(toggle(row.id, checked === true))}
          />
        ))
      )}
    </fieldset>
  );
}

/** Page-level settings, shown in the inspector while no block is selected. */
export function PageSettings({
  page,
  positions,
  editable,
  onEdit,
}: PageSettingsProps): ReactElement {
  const iconListId = useId();
  const slugError = validatePageSlug(page.slug);
  const titleError = page.title.trim() === "" ? "Enter a title." : null;
  return (
    <section aria-label="Page settings" className="grid gap-3">
      <p className="text-sm text-fg-muted">Select a block to edit it, or change the page here.</p>
      <Field label="Title" required error={titleError} disabled={!editable}>
        <Input
          maxLength={200}
          value={page.title}
          onChange={(event) =>
            onEdit({ ...page, title: event.target.value }, { key: "page:title" })
          }
        />
      </Field>
      <Field
        label="URL slug"
        required
        disabled={!editable}
        error={slugError}
        description={
          <>
            Served at <code className="font-mono text-fg">{pageUrlPath(page.slug)}</code>
          </>
        }
      >
        <Input
          mono
          maxLength={80}
          value={page.slug}
          spellCheck={false}
          autoCapitalize="none"
          onChange={(event) => onEdit({ ...page, slug: event.target.value }, { key: "page:slug" })}
        />
      </Field>
      <Field label="Description" disabled={!editable}>
        <Textarea
          maxLength={2000}
          rows={3}
          value={page.description ?? ""}
          onChange={(event) =>
            onEdit(
              { ...page, description: event.target.value === "" ? null : event.target.value },
              { key: "page:description" },
            )
          }
        />
      </Field>
      <Field
        label="Icon"
        disabled={!editable}
        description="A Lucide icon name, e.g. layout-dashboard. Unknown names show the generic page icon. TODO(implementation): icon picker."
      >
        <Input
          mono
          maxLength={100}
          list={iconListId}
          value={page.icon ?? ""}
          spellCheck={false}
          onChange={(event) =>
            onEdit(
              { ...page, icon: event.target.value === "" ? null : event.target.value },
              { key: "page:icon" },
            )
          }
        />
      </Field>
      <datalist id={iconListId}>
        {knownPageIconNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <PositionChecklist
        legend="Homepage for"
        description="Positions whose homepage is this page. A position can have only one homepage page."
        selected={page.homepageForPositionIds}
        positions={positions}
        disabled={!editable}
        onChange={(next) =>
          onEdit(
            { ...page, homepageForPositionIds: next },
            { announce: "Homepage positions updated." },
          )
        }
      />
      <PositionChecklist
        legend="Who can view this page"
        description="Leave all unchecked for no extra restriction. This narrows access; it never grants it, and each block still checks its own data permissions."
        selected={page.access.positionIds}
        positions={positions}
        disabled={!editable}
        onChange={(next) =>
          onEdit(
            { ...page, access: { ...page.access, positionIds: next } },
            { announce: "Page access updated." },
          )
        }
      />
    </section>
  );
}
