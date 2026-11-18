import {
  type ThemeDefinition,
  type ThemeMode,
  type ThemeTokens,
  themeDefinitionSchema,
} from "@argus/schema";
import { type ReactElement, useId, useState } from "react";
import { PageHeader } from "../workflows/status-views.js";
import { useAdminSave, useTheme } from "./admin-queries.js";
import { checkThemeContrast } from "./definition-logic.js";
import { QueryGate } from "./query-gate.js";
import { DraftToolbar, useDraft } from "./use-draft.js";

type TokenGroup = "colors" | "radii" | "spacing" | "typography";
const GROUPS: readonly { key: TokenGroup; label: string }[] = [
  { key: "colors", label: "Colours" },
  { key: "radii", label: "Radii" },
  { key: "spacing", label: "Spacing" },
  { key: "typography", label: "Typography" },
];
const MODES: readonly ThemeMode[] = ["light", "dark", "high-contrast"];

function TokenGroupEditor({
  label,
  entries,
  onChange,
}: {
  readonly label: string;
  readonly entries: Readonly<Record<string, string>>;
  readonly onChange: (next: Record<string, string>) => void;
}): ReactElement {
  const [newKey, setNewKey] = useState("");
  const baseId = useId();
  return (
    <fieldset>
      <legend>{label}</legend>
      {Object.entries(entries).length === 0 ? (
        <p className="argus-muted">No tokens defined.</p>
      ) : null}
      {Object.entries(entries).map(([name, value]) => (
        <div key={name} className="argus-cluster" style={{ marginBlockEnd: "0.25rem" }}>
          <label
            htmlFor={`${baseId}-${name}`}
            style={{ minWidth: "8rem", fontFamily: "var(--argus-font-mono)" }}
          >
            {name}
          </label>
          <input
            id={`${baseId}-${name}`}
            value={value}
            spellCheck={false}
            onChange={(event) => onChange({ ...entries, [name]: event.target.value })}
          />
          <button
            type="button"
            aria-label={`Remove ${label} token ${name}`}
            onClick={() => {
              const { [name]: _removed, ...rest } = entries;
              onChange(rest);
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="argus-cluster">
        <label htmlFor={`${baseId}-new`}>New {label.toLowerCase()} token name</label>
        <input id={`${baseId}-new`} value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <button
          type="button"
          disabled={newKey.trim() === "" || newKey in entries}
          onClick={() => {
            onChange({ ...entries, [newKey.trim()]: "" });
            setNewKey("");
          }}
        >
          Add token
        </button>
      </div>
    </fieldset>
  );
}

function ThemeEditor({ theme }: { readonly theme: ThemeDefinition }): ReactElement {
  const save = useAdminSave<ThemeDefinition, ThemeDefinition>("theme", (service, request) =>
    service.saveTheme({
      scope: request.session.scope,
      actor: request.session.actor,
      expectedVersion: request.expectedVersion,
      definition: request.definition,
    }),
  );
  const controller = useDraft(theme, (expectedVersion, definition) =>
    save.mutateAsync({ expectedVersion, definition }),
  );
  const { draft, edit } = controller;
  const [mode, setMode] = useState<ThemeMode>(draft.activeMode);
  const nameId = useId();
  const tokens = draft.modes[mode];
  const contrast = checkThemeContrast(tokens.colors);
  const validation = themeDefinitionSchema.safeParse(draft);

  const setTokens = (next: ThemeTokens): void =>
    edit((current) => ({ ...current, modes: { ...current.modes, [mode]: next } }));

  return (
    <div className="argus-stack">
      <DraftToolbar
        controller={controller}
        conflictSummary="Review the other version before choosing."
      />
      <section className="argus-panel">
        <h2 style={{ marginTop: 0 }}>General</h2>
        <label htmlFor={nameId} style={{ display: "block", fontWeight: 600 }}>
          Theme name
        </label>
        <input
          id={nameId}
          value={draft.name}
          onChange={(e) => edit((c) => ({ ...c, name: e.target.value }))}
        />
        <div>
          <label>
            <input
              type="checkbox"
              checked={draft.rightToLeft}
              onChange={(e) => edit((c) => ({ ...c, rightToLeft: e.target.checked }))}
            />{" "}
            Right-to-left layout
          </label>
        </div>
        <div>
          <label htmlFor={`${nameId}-logo`} style={{ display: "block", fontWeight: 600 }}>
            Logo attachment ID (object storage)
          </label>
          <input
            id={`${nameId}-logo`}
            value={draft.logoAttachmentId ?? ""}
            onChange={(e) =>
              edit((c) => ({
                ...c,
                logoAttachmentId: e.target.value === "" ? null : e.target.value,
              }))
            }
          />
          <small className="argus-muted" style={{ display: "block" }}>
            Upload is TODO(implementation); status colours and contrast roles stay locked by policy.
          </small>
        </div>
      </section>

      <section className="argus-panel">
        <h2 style={{ marginTop: 0 }}>Terminology</h2>
        {(["incident", "position", "board", "record"] as const).map((term) => (
          <div key={term}>
            <label htmlFor={`${nameId}-${term}`} style={{ display: "block", fontWeight: 600 }}>
              Word for “{term}”
            </label>
            <input
              id={`${nameId}-${term}`}
              value={draft.terminology[term]}
              onChange={(e) =>
                edit((c) => ({ ...c, terminology: { ...c.terminology, [term]: e.target.value } }))
              }
            />
          </div>
        ))}
      </section>

      <section className="argus-panel" aria-labelledby="tokens-heading">
        <h2 id="tokens-heading" style={{ marginTop: 0 }}>
          Tokens
        </h2>
        <div role="radiogroup" aria-label="Mode being edited" className="argus-cluster">
          {MODES.map((candidate) => (
            <label key={candidate}>
              <input
                type="radio"
                name={`${nameId}-mode`}
                checked={mode === candidate}
                onChange={() => setMode(candidate)}
              />{" "}
              {candidate}
            </label>
          ))}
        </div>
        <fieldset>
          <legend>Density</legend>
          {(["comfortable", "compact"] as const).map((density) => (
            <label key={density} style={{ marginInlineEnd: "1rem" }}>
              <input
                type="radio"
                name={`${nameId}-density`}
                checked={tokens.density === density}
                onChange={() => setTokens({ ...tokens, density })}
              />{" "}
              {density}
            </label>
          ))}
        </fieldset>
        {GROUPS.map((group) => (
          <TokenGroupEditor
            key={`${mode}-${group.key}`}
            label={group.label}
            entries={tokens[group.key]}
            onChange={(next) => setTokens({ ...tokens, [group.key]: next })}
          />
        ))}
      </section>

      <section className="argus-panel" aria-labelledby="contrast-heading">
        <h2 id="contrast-heading" style={{ marginTop: 0 }}>
          WCAG 2.2 AA contrast ({mode})
        </h2>
        <ul>
          {contrast.map((check) => (
            <li key={check.label}>
              <span aria-hidden="true">{check.pass ? "✓" : "✕"} </span>
              {check.label}:{" "}
              {check.ratio === null
                ? `cannot be measured — define hex tokens “${check.foregroundKey}” and “${check.backgroundKey}”`
                : `${check.ratio.toFixed(2)}:1 (needs ${check.minimum}:1) — ${check.pass ? "pass" : "fail"}`}
            </li>
          ))}
        </ul>
        {/* Sample uses the draft's own tokens; it is a style sample, not operational data. */}
        <section
          aria-label="Theme sample (not real data)"
          style={{
            padding: "0.75rem",
            border: `1px solid ${tokens.colors.border ?? "currentColor"}`,
            background: tokens.colors.surface,
            color: tokens.colors.text,
          }}
        >
          Sample text — <span style={{ color: tokens.colors.accent }}>accent link</span>
        </section>
      </section>

      {validation.success ? (
        <p role="status">✓ Draft matches the theme schema.</p>
      ) : (
        <section role="alert" className="argus-panel">
          <h2 style={{ marginTop: 0 }}>Schema problems</h2>
          <ul>
            {validation.error.issues.slice(0, 8).map((issue) => (
              <li key={`${issue.path.join(".")}-${issue.message}`}>
                <code>{issue.path.join(".") || "(root)"}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Theme and terminology admin (/admin/theme).
 * Input: none (scope from the session). Output: a draft editor for tenant tokens, terminology and logo.
 * Errors: load/save failures and version conflicts are shown inline; publishing is TODO(implementation).
 */
export function ThemeAdminScreen(): ReactElement {
  const query = useTheme();
  return (
    <article className="argus-stack">
      <PageHeader
        title="Theme and terminology"
        description="Versioned tenant tokens, density, contrast modes, logo and core terminology."
      />
      <QueryGate
        query={query}
        noun="theme"
        emptyDescription="No tenant theme exists yet. Creating one requires the theme API (TODO(implementation))."
      >
        {(theme) => <ThemeEditor key={theme.id} theme={theme} />}
      </QueryGate>
    </article>
  );
}
