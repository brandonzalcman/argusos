import { Checkbox, Field, Input } from "@argus/ui";
import { type ReactElement, useState } from "react";
import { type ScopedLiveQuery, useScopedLiveQuery } from "../live-data/use-scoped-live-query.js";
import type { AlertsSource, RecipientOption } from "./alerts-source.js";
import { filterRecipients, type RecipientKey, recipientKey, toggleItem } from "./compose.js";

/**
 * Live query of pickable recipient groups for the active scope.
 * Input: the alerts source (its optional listRecipients port).
 * Output: loading/unavailable/error/empty/ready state; absent port reports an error, not rows.
 * Errors: surfaced as the error state.
 * Depends on: useScopedLiveQuery and the `alert_recipients` directory shape.
 */
export function useRecipientOptions(source: AlertsSource): ScopedLiveQuery<RecipientOption> {
  return useScopedLiveQuery<RecipientOption>({
    queryKey: ["alert-recipients"],
    tableId: "alert_recipients",
    requiredPermissions: ["alert:send"],
    load: (scope) =>
      source.listRecipients === undefined
        ? Promise.reject(new Error("This data source does not provide recipient groups."))
        : source.listRecipients(scope),
  });
}

export interface RecipientPickerProps {
  readonly options: readonly RecipientOption[];
  readonly selected: readonly RecipientKey[];
  readonly onChange: (selected: readonly RecipientKey[]) => void;
  readonly error?: string | undefined;
}

/** Multi-select of positions and contact groups with a name filter; keyboard and screen-reader friendly. */
export function RecipientPicker({
  options,
  selected,
  onChange,
  error,
}: RecipientPickerProps): ReactElement {
  const [query, setQuery] = useState("");
  const visible = filterRecipients(options, query);
  const groups = [
    { title: "Positions", items: visible.filter((option) => option.kind === "position") },
    {
      title: "Contact groups",
      items: visible.filter((option) => option.kind === "contact-group"),
    },
  ];
  return (
    <fieldset
      className="grid gap-2"
      aria-describedby={error === undefined ? undefined : "recipients-error"}
    >
      <legend className="text-sm font-medium text-fg">
        Recipients <span className="font-normal text-fg-muted">({selected.length} selected)</span>
      </legend>
      <Field label="Filter recipients" hideLabel>
        <Input
          type="search"
          placeholder="Filter by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Field>
      <div className="grid max-h-60 gap-3 overflow-y-auto rounded-sm border border-border bg-surface-sunken p-3">
        {visible.length === 0 ? (
          <p className="text-sm text-fg-muted">No recipient groups match this filter.</p>
        ) : (
          groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.title} className="grid gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {group.title}
                </p>
                {group.items.map((option) => (
                  <Checkbox
                    key={recipientKey(option)}
                    label={option.name}
                    {...(option.memberCount === null
                      ? {}
                      : { description: `${option.memberCount} people` })}
                    checked={selected.includes(recipientKey(option))}
                    onCheckedChange={() => onChange(toggleItem(selected, recipientKey(option)))}
                  />
                ))}
              </div>
            ),
          )
        )}
      </div>
      {error === undefined ? null : (
        <p id="recipients-error" className="text-sm text-critical">
          {error}
        </p>
      )}
    </fieldset>
  );
}
