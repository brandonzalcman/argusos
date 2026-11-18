import { DensityControl } from "@argus/ui";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useId, useState } from "react";
import { PageHeader } from "../workflows/status-views.js";
import { useAdminSave, useClearOfflineData, usePreferences } from "./admin-queries.js";
import type { UserPreferences } from "./admin-service.js";
import { QueryGate } from "./query-gate.js";
import { DraftToolbar, useDraft } from "./use-draft.js";

const LOCALES: readonly { tag: string; label: string; rtl: boolean }[] = [
  { tag: "en", label: "English", rtl: false },
  { tag: "es", label: "Español", rtl: false },
  { tag: "fr", label: "Français", rtl: false },
  { tag: "ar", label: "العربية", rtl: true },
  { tag: "he", label: "עברית", rtl: true },
];

function PreferencesEditor({
  preferences,
}: {
  readonly preferences: UserPreferences;
}): ReactElement {
  const save = useAdminSave<UserPreferences, UserPreferences>("preferences", (service, request) =>
    service.savePreferences({
      scope: request.session.scope,
      actor: request.session.actor,
      expectedVersion: request.expectedVersion,
      definition: request.definition,
    }),
  );
  const controller = useDraft(preferences, (expectedVersion, definition) =>
    save.mutateAsync({ expectedVersion, definition }),
  );
  const { draft, edit } = controller;
  const localeId = useId();
  const motionName = useId();
  const clear = useClearOfflineData();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="argus-stack">
      <DraftToolbar controller={controller} />
      <section className="argus-panel">
        <h2 style={{ marginTop: 0 }}>Display</h2>
        <DensityControl
          value={draft.density}
          onChange={(density) => edit((c) => ({ ...c, density }))}
        />
        <fieldset>
          <legend>Motion</legend>
          {(
            [
              ["system", "Follow system setting"],
              ["reduce", "Reduce motion"],
              ["allow", "Allow motion"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ display: "block" }}>
              <input
                type="radio"
                name={motionName}
                checked={draft.reducedMotion === value}
                onChange={() => edit((c) => ({ ...c, reducedMotion: value }))}
              />{" "}
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="argus-panel">
        <h2 style={{ marginTop: 0 }}>Language</h2>
        <label htmlFor={localeId} style={{ display: "block", fontWeight: 600 }}>
          Language
        </label>
        <select
          id={localeId}
          value={draft.locale}
          onChange={(e) => {
            const locale = LOCALES.find((l) => l.tag === e.target.value);
            edit((c) => ({
              ...c,
              locale: e.target.value,
              rightToLeft: locale ? locale.rtl : c.rightToLeft,
            }));
          }}
        >
          {LOCALES.map((l) => (
            <option key={l.tag} value={l.tag}>
              {l.label}
            </option>
          ))}
          {LOCALES.some((l) => l.tag === draft.locale) ? null : (
            <option value={draft.locale}>{draft.locale}</option>
          )}
        </select>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={draft.rightToLeft}
            onChange={(e) => edit((c) => ({ ...c, rightToLeft: e.target.checked }))}
          />{" "}
          Right-to-left layout
        </label>
      </section>

      <section className="argus-panel" aria-labelledby="offline-heading">
        <h2 id="offline-heading" style={{ marginTop: 0 }}>
          Offline data
        </h2>
        <p className="argus-muted">
          Clearing removes data cached on this device. Changes still waiting to sync are reported
          before anything is removed.
        </p>
        {confirmClear ? (
          <div
            role="alertdialog"
            aria-label="Confirm clearing offline data"
            className="argus-cluster"
          >
            <span>Clear all offline data on this device?</span>
            <button
              type="button"
              onClick={() => clear.mutate(undefined, { onSettled: () => setConfirmClear(false) })}
              disabled={clear.isPending}
            >
              Clear offline data
            </button>
            <button type="button" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)}>
            Clear offline data…
          </button>
        )}
        {clear.isError ? (
          <div role="alert" style={{ color: "var(--argus-color-danger)" }}>
            ✕ {clear.error.message}
          </div>
        ) : null}
        {clear.isSuccess ? <div role="status">✓ Offline data cleared.</div> : null}
      </section>
    </div>
  );
}

/**
 * User settings (/settings): density, motion, language/RTL and offline-data controls.
 * Errors: load/save failures and conflicts render inline; sessions management is TODO(implementation).
 */
export function SettingsScreen(): ReactElement {
  const query = usePreferences();
  return (
    <article className="argus-stack">
      <PageHeader title="Settings" description="Your display, language and offline preferences.">
        <p>
          <Link to="/admin">Administration</Link> holds tenant-wide theme, menu and homepage
          settings.
        </p>
      </PageHeader>
      <QueryGate
        query={query}
        noun="preferences"
        emptyDescription="No preferences are stored for this account yet."
      >
        {(preferences) => <PreferencesEditor key={preferences.version} preferences={preferences} />}
      </QueryGate>
    </article>
  );
}
