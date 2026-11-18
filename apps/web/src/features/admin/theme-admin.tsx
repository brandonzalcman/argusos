import {
  type ThemeDefinition,
  type ThemeMode,
  type ThemeTokens,
  themeDefinitionSchema,
} from "@argus/schema";
import {
  Badge,
  Button,
  DensityControl,
  Field,
  IconButton,
  Input,
  PageContainer,
  PageHeader,
  Panel,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@argus/ui";
import { CircleCheck, CircleX, Plus, Trash2 } from "@argus/ui/icons";
import { type ReactElement, useState } from "react";
import { useAdminSave, useTheme } from "./admin-queries.js";
import { checkThemeContrast } from "./definition-logic.js";
import { LogoUpload } from "./logo-upload.js";
import { QueryGate } from "./query-gate.js";
import { DraftActions, DraftConflict, useDraft } from "./use-draft.js";

type TokenGroup = "colors" | "radii" | "spacing" | "typography";
const GROUPS: readonly { key: TokenGroup; label: string }[] = [
  { key: "colors", label: "Colours" },
  { key: "radii", label: "Radii" },
  { key: "spacing", label: "Spacing" },
  { key: "typography", label: "Typography" },
];
const MODES: readonly ThemeMode[] = ["light", "dark", "high-contrast"];
const TERMS = ["incident", "position", "board", "record"] as const;

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
  const names = Object.keys(entries);
  return (
    <fieldset className="grid content-start gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-semibold text-fg">{label}</legend>
      {names.length === 0 ? <p className="text-sm text-fg-subtle">No tokens defined.</p> : null}
      {names.map((name) => (
        <div key={name} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-end gap-2">
          <span className="pb-2 font-mono text-sm text-fg-muted">{name}</span>
          <Field label={`${label} token ${name}`} hideLabel>
            <Input
              mono
              value={entries[name] ?? ""}
              spellCheck={false}
              onChange={(event) => onChange({ ...entries, [name]: event.target.value })}
            />
          </Field>
          <IconButton
            label={`Remove ${label.toLowerCase()} token ${name}`}
            icon={<Trash2 />}
            onClick={() => {
              const { [name]: _removed, ...rest } = entries;
              onChange(rest);
            }}
          />
        </div>
      ))}
      <div className="flex items-end gap-2">
        <Field label={`New ${label.toLowerCase()} token name`} className="max-w-xs flex-1">
          <Input mono value={newKey} onChange={(event) => setNewKey(event.target.value)} />
        </Field>
        <Button
          leadingIcon={<Plus aria-hidden="true" />}
          disabled={newKey.trim() === "" || newKey.trim() in entries}
          onClick={() => {
            onChange({ ...entries, [newKey.trim()]: "" });
            setNewKey("");
          }}
        >
          Add token
        </Button>
      </div>
    </fieldset>
  );
}

function ContrastList({ tokens }: { readonly tokens: ThemeTokens }): ReactElement {
  const checks = checkThemeContrast(tokens.colors);
  return (
    <ul className="grid gap-1.5">
      {checks.map((check) => (
        <li key={check.label} className="flex flex-wrap items-center gap-2 text-base">
          <Badge
            tone={check.pass ? "success" : check.ratio === null ? "neutral" : "critical"}
            icon={check.pass ? <CircleCheck /> : <CircleX />}
          >
            {check.pass ? "Pass" : check.ratio === null ? "Not measured" : "Fail"}
          </Badge>
          <span>{check.label}</span>
          <span className="font-mono text-sm text-fg-muted">
            {check.ratio === null
              ? `define hex tokens "${check.foregroundKey}" and "${check.backgroundKey}"`
              : `${check.ratio.toFixed(2)}:1 (needs ${check.minimum}:1)`}
          </span>
        </li>
      ))}
    </ul>
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
  const validation = themeDefinitionSchema.safeParse(draft);

  const setTokens = (target: ThemeMode, next: ThemeTokens): void =>
    edit((current) => ({ ...current, modes: { ...current.modes, [target]: next } }));

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Theme and terminology"
        description="Versioned tenant tokens, density, contrast modes, logo and core terminology."
        actions={<DraftActions controller={controller} />}
      />
      <DraftConflict
        controller={controller}
        recordLabel={draft.name}
        describe={(mine, theirs) => [
          { fieldId: "name", fieldLabel: "Name", localValue: mine.name, serverValue: theirs.name },
          {
            fieldId: "terminology",
            fieldLabel: "Terminology",
            localValue: TERMS.map((t) => mine.terminology[t]).join(" / "),
            serverValue: TERMS.map((t) => theirs.terminology[t]).join(" / "),
          },
        ]}
      />
      <div className="grid items-start gap-(--argus-gap) lg:grid-cols-2">
        <Panel title="General" bodyClassName="grid gap-4">
          <Field label="Theme name">
            <Input
              value={draft.name}
              onChange={(event) => edit((c) => ({ ...c, name: event.target.value }))}
            />
          </Field>
          <Switch
            label="Right-to-left layout"
            checked={draft.rightToLeft}
            onCheckedChange={(rightToLeft) => edit((c) => ({ ...c, rightToLeft }))}
          />
        </Panel>
        <Panel
          title="Terminology"
          description="The words your organisation uses. Plain text only."
          bodyClassName="grid gap-3 sm:grid-cols-2"
        >
          {TERMS.map((term) => (
            <Field key={term} label={`Word for "${term}"`}>
              <Input
                value={draft.terminology[term]}
                onChange={(event) =>
                  edit((c) => ({
                    ...c,
                    terminology: { ...c.terminology, [term]: event.target.value },
                  }))
                }
              />
            </Field>
          ))}
        </Panel>
      </div>
      <Panel
        title="Logo"
        description="Stored in object storage; the theme keeps only the attachment id."
      >
        <LogoUpload
          attachmentId={draft.logoAttachmentId}
          onChange={(logoAttachmentId) => edit((c) => ({ ...c, logoAttachmentId }))}
        />
      </Panel>
      <Panel
        title="Tokens"
        description="Status colours are locked by the design system and cannot be overridden here."
      >
        <Tabs value={mode} onValueChange={(next) => setMode(next as ThemeMode)}>
          <TabsList aria-label="Mode being edited">
            {MODES.map((m) => (
              <TabsTrigger key={m} value={m}>
                {m}
              </TabsTrigger>
            ))}
          </TabsList>
          {MODES.map((m) => {
            const tokens = draft.modes[m];
            return (
              <TabsContent key={m} value={m} className="grid gap-4 pt-4">
                <DensityControl
                  label="Density"
                  value={tokens.density}
                  onChange={(density) => setTokens(m, { ...tokens, density })}
                />
                <div className="grid items-start gap-3 xl:grid-cols-2">
                  {GROUPS.map((group) => (
                    <TokenGroupEditor
                      key={`${m}-${group.key}`}
                      label={group.label}
                      entries={tokens[group.key]}
                      onChange={(next) => setTokens(m, { ...tokens, [group.key]: next })}
                    />
                  ))}
                </div>
                <section aria-label={`WCAG 2.2 AA contrast for ${m}`} className="grid gap-2">
                  <h3 className="text-md font-semibold text-fg">WCAG 2.2 AA contrast ({m})</h3>
                  <ContrastList tokens={tokens} />
                  <div
                    role="img"
                    aria-label="Style sample using this mode's tokens (not real data)"
                    className="rounded-md border p-3 text-base"
                    style={{
                      background: tokens.colors.surface,
                      color: tokens.colors.text,
                      borderColor: tokens.colors.border,
                    }}
                  >
                    Sample text and{" "}
                    <span style={{ color: tokens.colors.accent }}>an accent link</span>
                  </div>
                </section>
              </TabsContent>
            );
          })}
        </Tabs>
      </Panel>
      <Panel
        title="Schema check"
        status={
          validation.success ? (
            <Badge tone="success" icon={<CircleCheck />}>
              Valid
            </Badge>
          ) : (
            <Badge tone="critical" icon={<CircleX />}>
              {validation.error.issues.length} problems
            </Badge>
          )
        }
      >
        {validation.success ? (
          <p className="text-base text-fg-muted">The draft matches the theme schema.</p>
        ) : (
          <ul className="grid gap-1 text-base">
            {validation.error.issues.slice(0, 8).map((issue) => (
              <li key={`${issue.path.join(".")}-${issue.message}`}>
                <code className="font-mono text-sm">{issue.path.join(".") || "(root)"}</code>:{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContainer>
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
    <QueryGate
      query={query}
      noun="theme"
      title="Theme and terminology"
      description="Versioned tenant tokens, density, contrast modes, logo and core terminology."
      emptyDescription="No tenant theme exists yet. Creating one requires the theme API (TODO(implementation))."
    >
      {(theme) => <ThemeEditor key={theme.id} theme={theme} />}
    </QueryGate>
  );
}
