import type {
  FieldDefinition,
  FilterCondition,
  FilterGroup,
  FilterOperator,
  ViewDefinition,
} from "@argus/schema";
import {
  Button,
  Card,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  StatusPill,
} from "@argus/ui";
import { Columns3, Filter, FolderPlus, Plus, Trash2 } from "@argus/ui/icons";
import { type ReactElement, useId, useState } from "react";
import { NativeSelect, nativeControl } from "./controls.js";
import { filterOperatorsFor, operatorLabels } from "./field-catalog.js";
import type { GridViewState } from "./grid-model.js";

export type SaveViewStatus =
  | { readonly state: "idle" }
  | { readonly state: "saving" }
  | { readonly state: "saved"; readonly name: string }
  | { readonly state: "error"; readonly message: string };

export interface ViewToolbarProps {
  readonly fields: readonly FieldDefinition[];
  readonly state: GridViewState;
  readonly onChange: (next: GridViewState) => void;
  readonly views: readonly ViewDefinition[];
  readonly viewsLoading: boolean;
  readonly activeViewId: string | null;
  readonly dirty: boolean;
  readonly onSelectView: (viewId: string | null) => void;
  readonly onSaveView: (name: string, mode: "update" | "new") => void;
  readonly saveStatus: SaveViewStatus;
}

/** Nested depth the editor offers; the query layer re-validates depth and node count. */
const MAX_DEPTH = 3;

const emptyGroup = (): FilterGroup => ({ conjunction: "and", conditions: [], groups: [] });

function defaultValueFor(field: FieldDefinition): FilterCondition["value"] {
  return field.type === "boolean" ? true : "";
}

function needsValue(operator: FilterOperator): boolean {
  return operator !== "is-empty" && operator !== "is-not-empty";
}

/** Counts leaf conditions so the toggle can show how many filters are active. */
export function countConditions(group: FilterGroup | null): number {
  return group
    ? group.conditions.length + group.groups.reduce((n, g) => n + countConditions(g), 0)
    : 0;
}

/** Removes empty child groups; returns null when nothing is left so "no filter" is stored as null. */
export function normalizeGroup(group: FilterGroup): FilterGroup | null {
  const groups = group.groups.flatMap((g) => {
    const next = normalizeGroup(g);
    return next ? [next] : [];
  });
  return group.conditions.length === 0 && groups.length === 0 ? null : { ...group, groups };
}

function ConditionValue({
  field,
  condition,
  onChange,
  label,
}: {
  readonly field: FieldDefinition;
  readonly condition: FilterCondition;
  readonly onChange: (value: FilterCondition["value"]) => void;
  readonly label: string;
}): ReactElement | null {
  if (!needsValue(condition.operator)) {
    return null;
  }
  const multi = condition.operator === "in" || condition.operator === "not-in";
  if (field.type === "boolean") {
    return (
      <NativeSelect
        aria-label={label}
        value={String(condition.value === true)}
        onChange={(e) => onChange(e.target.value === "true")}
      >
        <option value="true">{field.config.trueLabel}</option>
        <option value="false">{field.config.falseLabel}</option>
      </NativeSelect>
    );
  }
  if (
    (field.type === "single-select" || field.type === "multi-select" || field.type === "status") &&
    !multi
  ) {
    return (
      <NativeSelect
        aria-label={label}
        value={typeof condition.value === "string" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose…</option>
        {field.config.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  const type =
    field.type === "date"
      ? "date"
      : ["number", "currency", "percent", "duration"].includes(field.type) && !multi
        ? "number"
        : "text";
  return (
    <input
      aria-label={label}
      className={cn(nativeControl, "w-44")}
      type={type}
      step={type === "number" ? "any" : undefined}
      placeholder={multi ? "comma-separated" : undefined}
      value={
        Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value ?? "")
      }
      onChange={(e) =>
        onChange(
          multi
            ? e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : e.target.value,
        )
      }
    />
  );
}

interface GroupEditorProps {
  readonly group: FilterGroup;
  readonly depth: number;
  readonly path: string;
  readonly fields: readonly FieldDefinition[];
  readonly onChange: (next: FilterGroup) => void;
  readonly onRemove?: () => void;
}

/** Recursive AND/OR group editor. Conditions on hidden fields never appear because `fields` is already filtered. */
function GroupEditor({
  group,
  depth,
  path,
  fields,
  onChange,
  onRemove,
}: GroupEditorProps): ReactElement {
  const filterable = fields.filter((f) => filterOperatorsFor(f.type).length > 0);

  const addCondition = (): void => {
    const field = filterable[0];
    if (field) {
      onChange({
        ...group,
        conditions: [
          ...group.conditions,
          {
            fieldId: field.id,
            operator: filterOperatorsFor(field.type)[0] ?? "equals",
            value: defaultValueFor(field),
          },
        ],
      });
    }
  };

  return (
    <fieldset
      className={
        depth === 0
          ? "m-0 grid min-w-0 gap-2 border-0 p-0"
          : "m-0 grid min-w-0 gap-2 rounded-md border border-border bg-surface-sunken p-3"
      }
    >
      <legend className="sr-only">{depth === 0 ? "Filters" : `Filter group ${path}`}</legend>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Match</span>
        <NativeSelect
          aria-label={`${depth === 0 ? "Filters" : `Group ${path}`} match mode`}
          className="w-auto"
          value={group.conjunction}
          onChange={(e) =>
            onChange({ ...group, conjunction: e.target.value === "or" ? "or" : "and" })
          }
        >
          <option value="and">all</option>
          <option value="or">any</option>
        </NativeSelect>
        <span>of the following</span>
        {onRemove ? (
          <Button size="sm" variant="ghost" leadingIcon={<Trash2 />} onClick={onRemove}>
            Remove group {path}
          </Button>
        ) : null}
      </div>

      {group.conditions.map((condition, index) => {
        const field = fields.find((f) => f.id === condition.fieldId);
        const operators = field ? filterOperatorsFor(field.type) : [];
        const update = (patch: Partial<FilterCondition>): void =>
          onChange({
            ...group,
            conditions: group.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
          });
        const label = `Filter ${path ? `${path}.` : ""}${index + 1}`;
        return (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label={`${label} field`}
              className="w-44"
              value={condition.fieldId}
              onChange={(e) => {
                const next = fields.find((f) => f.id === e.target.value);
                if (next) {
                  update({
                    fieldId: next.id,
                    operator: filterOperatorsFor(next.type)[0] ?? "equals",
                    value: defaultValueFor(next),
                  });
                }
              }}
            >
              {filterable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label={`${label} operator`}
              className="w-40"
              value={condition.operator}
              onChange={(e) => update({ operator: e.target.value as FilterOperator })}
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {operatorLabels[op]}
                </option>
              ))}
            </NativeSelect>
            {field ? (
              <ConditionValue
                field={field}
                condition={condition}
                label={`${label} value`}
                onChange={(value) => update({ value })}
              />
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<Trash2 />}
              aria-label={`Remove ${label.toLocaleLowerCase()}`}
              onClick={() =>
                onChange({ ...group, conditions: group.conditions.filter((_, i) => i !== index) })
              }
            >
              Remove
            </Button>
          </div>
        );
      })}

      {group.groups.map((child, index) => (
        <GroupEditor
          key={index}
          group={child}
          depth={depth + 1}
          path={`${path ? `${path}.` : ""}${index + 1}`}
          fields={fields}
          onChange={(next) =>
            onChange({ ...group, groups: group.groups.map((g, i) => (i === index ? next : g)) })
          }
          onRemove={() =>
            onChange({ ...group, groups: group.groups.filter((_, i) => i !== index) })
          }
        />
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Plus />}
          disabled={filterable.length === 0}
          onClick={addCondition}
        >
          Add filter
        </Button>
        {depth < MAX_DEPTH - 1 ? (
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<FolderPlus />}
            disabled={filterable.length === 0}
            onClick={() => onChange({ ...group, groups: [...group.groups, emptyGroup()] })}
          >
            Add group
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}

/**
 * Sort / filter / group / column visibility controls plus saved-view selection.
 * Filters are a nested AND/OR tree matching the persisted FilterGroup contract (depth capped in the UI;
 * the query layer re-validates depth, node count and field permissions).
 * TODO(implementation): colour rules (CEL) editor.
 */
export function ViewToolbar({
  fields,
  state,
  onChange,
  views,
  viewsLoading,
  activeViewId,
  dirty,
  onSelectView,
  onSaveView,
  saveStatus,
}: ViewToolbarProps): ReactElement {
  const ids = { view: useId(), group: useId(), name: useId() };
  const [viewName, setViewName] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const active = views.find((v) => v.id === activeViewId) ?? null;
  const filterCount = countConditions(state.filters);

  return (
    <Card className="grid gap-3 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label htmlFor={ids.view} className="text-xs font-semibold text-fg-muted uppercase">
            Saved view
          </label>
          <NativeSelect
            id={ids.view}
            className="w-56"
            value={activeViewId ?? ""}
            disabled={viewsLoading}
            onChange={(e) => onSelectView(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">{viewsLoading ? "Loading views…" : "All rows (unsaved view)"}</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {active ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!dirty || saveStatus.state === "saving"}
            onClick={() => onSaveView(active.name, "update")}
          >
            Update “{active.name}”
          </Button>
        ) : null}
        <div className="grid gap-1">
          <label htmlFor={ids.name} className="text-xs font-semibold text-fg-muted uppercase">
            New view name
          </label>
          <Input
            id={ids.name}
            className="w-52"
            value={viewName}
            maxLength={200}
            onChange={(e) => setViewName(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={viewName.trim() === "" || saveStatus.state === "saving"}
          loading={saveStatus.state === "saving"}
          onClick={() => {
            onSaveView(viewName.trim(), "new");
            setViewName("");
          }}
        >
          Save as new view
        </Button>
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
          {dirty ? <StatusPill status="medium" label="Unsaved view changes" size="sm" /> : null}
          {saveStatus.state === "saved" ? <span>Saved “{saveStatus.name}”</span> : null}
          {saveStatus.state === "error" ? (
            <span className="text-critical">Could not save view: {saveStatus.message}</span>
          ) : null}
        </div>
        <div className="grid gap-1">
          <label htmlFor={ids.group} className="text-xs font-semibold text-fg-muted uppercase">
            Group by
          </label>
          <NativeSelect
            id={ids.group}
            className="w-44"
            value={state.grouping?.fieldId ?? ""}
            onChange={(e) =>
              onChange({
                ...state,
                grouping:
                  e.target.value === ""
                    ? null
                    : { fieldId: e.target.value, direction: "ascending", collapsed: false },
              })
            }
          >
            <option value="">No grouping</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" leadingIcon={<Columns3 />}>
              Fields ({fields.length - state.hiddenFieldIds.length}/{fields.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Visible fields</DropdownMenuLabel>
            {fields.map((f) => (
              <DropdownMenuCheckboxItem
                key={f.id}
                checked={!state.hiddenFieldIds.includes(f.id)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...state,
                    hiddenFieldIds: checked
                      ? state.hiddenFieldIds.filter((id) => id !== f.id)
                      : [...state.hiddenFieldIds, f.id],
                  })
                }
              >
                {f.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant={filterCount > 0 ? "primary" : "secondary"}
          leadingIcon={<Filter />}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters{filterCount > 0 ? ` (${filterCount})` : ""}
        </Button>
        {state.sorts.length > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-fg-muted">
              Sorted by{" "}
              {state.sorts
                .map(
                  (s) =>
                    `${fields.find((f) => f.id === s.fieldId)?.name ?? "?"} ${s.direction === "ascending" ? "↑" : "↓"}`,
                )
                .join(", ")}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...state, sorts: [] })}>
              Clear sort
            </Button>
          </div>
        ) : null}
      </div>

      {showFilters ? (
        <div className="rounded-md border border-border bg-surface p-3">
          <GroupEditor
            group={state.filters ?? emptyGroup()}
            depth={0}
            path=""
            fields={fields}
            onChange={(next) => onChange({ ...state, filters: normalizeRoot(next) })}
          />
        </div>
      ) : null}
    </Card>
  );
}

/** Keeps an empty root group editable (so "Add filter" works) while storing "no filter" as null once cleared. */
function normalizeRoot(group: FilterGroup): FilterGroup | null {
  return group.conditions.length === 0 && group.groups.length === 0 ? null : group;
}
