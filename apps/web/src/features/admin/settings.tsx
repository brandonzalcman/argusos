import {
  Badge,
  Button,
  ConfirmDialog,
  DensityControl,
  EmptyState,
  Field,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableStateRow,
} from "@argus/ui";
import { CircleCheck, LogOut, Trash2 } from "@argus/ui/icons";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";
import { useFeatureSession } from "../workflows/feature-scope.js";
import { formatTimestamp } from "../workflows/format.js";
import type { AccountSession } from "../workflows/local-types.js";
import { ErrorState, LoadingSkeleton, SessionUnavailable } from "../workflows/status-views.js";
import { useAccountSessions, useRevokeSession } from "./account-ports.js";
import { useAdminSave, useClearOfflineData, usePreferences } from "./admin-queries.js";
import type { UserPreferences } from "./admin-service.js";
import { QueryGate } from "./query-gate.js";
import { DraftActions, DraftConflict, useDraft } from "./use-draft.js";

const LOCALES: readonly { tag: string; label: string; rtl: boolean }[] = [
  { tag: "en", label: "English", rtl: false },
  { tag: "es", label: "Español", rtl: false },
  { tag: "fr", label: "Français", rtl: false },
  { tag: "ar", label: "العربية (Arabic)", rtl: true },
  { tag: "he", label: "עברית (Hebrew)", rtl: true },
];

const MOTION_OPTIONS = [
  { value: "system", label: "Follow system setting" },
  { value: "reduce", label: "Reduce motion" },
  { value: "allow", label: "Allow motion" },
];

function SessionsPanel(): ReactElement {
  const session = useFeatureSession();
  const query = useAccountSessions();
  const revoke = useRevokeSession();
  const [revoking, setRevoking] = useState<AccountSession | null>(null);

  let body: ReactElement;
  if (!session) {
    body = <SessionUnavailable />;
  } else if (query.isPending) {
    body = <LoadingSkeleton label="Loading sessions" rows={2} />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title="Couldn't load your sessions"
        error={query.error}
        onRetry={() => void query.refetch()}
        size="inline"
      />
    );
  } else if (query.data.length === 0) {
    body = (
      <EmptyState
        title="No sessions listed"
        description="Signed-in devices appear here once session management is connected."
      />
    );
  } else {
    body = (
      <TableContainer>
        <Table>
          <TableCaption className="sr-only">Your signed-in sessions</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2">
                    {row.deviceLabel}
                    {row.current ? (
                      <Badge tone="success" icon={<CircleCheck />}>
                        This device
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell muted>{row.locationLabel ?? "Unknown"}</TableCell>
                <TableCell mono>{formatTimestamp(row.lastActiveAt)}</TableCell>
                <TableCell align="end">
                  {row.current ? null : (
                    <Button
                      size="sm"
                      leadingIcon={<LogOut aria-hidden="true" />}
                      onClick={() => setRevoking(row)}
                    >
                      Sign out
                      <span className="sr-only"> {row.deviceLabel}</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {revoke.isError ? (
              <TableStateRow colSpan={4}>
                <ErrorState
                  title="Couldn't sign that session out"
                  error={revoke.error}
                  size="inline"
                />
              </TableStateRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <Panel
      title="Sessions"
      description="Devices signed in to your account. Signing one out ends it immediately."
      flush={query.isSuccess && query.data.length > 0}
    >
      {body}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title="Sign this session out?"
        itemName={revoking?.deviceLabel ?? ""}
        description="That device must sign in again. This is recorded in the audit log."
        confirmLabel="Sign out"
        destructive
        onConfirm={() => (revoking ? revoke.mutateAsync(revoking.id) : undefined)}
      />
    </Panel>
  );
}

function OfflinePanel(): ReactElement {
  const clear = useClearOfflineData();
  const [confirming, setConfirming] = useState(false);
  return (
    <Panel
      title="Offline data"
      description="Data cached on this device for offline use. Changes still waiting to sync are reported before anything is removed."
    >
      <div className="grid gap-3">
        <div>
          <Button leadingIcon={<Trash2 aria-hidden="true" />} onClick={() => setConfirming(true)}>
            Clear offline data…
          </Button>
        </div>
        {clear.isError ? (
          <ErrorState title="Couldn't clear offline data" error={clear.error} size="inline" />
        ) : null}
        {clear.isSuccess ? (
          <p role="status" className="flex items-center gap-1.5 text-base text-success">
            <CircleCheck aria-hidden="true" className="size-4" /> Offline data cleared.
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Clear offline data?"
        itemName="Offline data on this device"
        description="Cached records and drafts stored here are removed. Anything already synced stays on the server."
        confirmLabel="Clear offline data"
        destructive
        onConfirm={() => clear.mutateAsync()}
      />
    </Panel>
  );
}

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

  return (
    <PageContainer width="default">
      <PageHeader
        title="Settings"
        description="Your display, language, sessions and offline preferences."
        actions={<DraftActions controller={controller} />}
        meta={
          <span>
            Tenant-wide theme, menu and homepage settings live in{" "}
            <Link to="/admin" className="text-accent-text underline">
              Administration
            </Link>
            .
          </span>
        }
      />
      <DraftConflict
        controller={controller}
        recordLabel="Your preferences"
        describe={(mine, theirs) => [
          {
            fieldId: "density",
            fieldLabel: "Density",
            localValue: mine.density,
            serverValue: theirs.density,
          },
          {
            fieldId: "locale",
            fieldLabel: "Language",
            localValue: mine.locale,
            serverValue: theirs.locale,
          },
        ]}
      />
      <Panel title="Display" bodyClassName="grid gap-4">
        <DensityControl
          value={draft.density}
          onChange={(density) => edit((c) => ({ ...c, density }))}
        />
        <Field label="Motion" className="max-w-sm">
          <Select
            value={draft.reducedMotion}
            options={MOTION_OPTIONS}
            onValueChange={(reducedMotion) =>
              edit((c) => ({
                ...c,
                reducedMotion: reducedMotion as UserPreferences["reducedMotion"],
              }))
            }
          />
        </Field>
      </Panel>
      <Panel title="Language" bodyClassName="grid gap-4">
        <Field label="Language" className="max-w-sm">
          <Select
            value={draft.locale}
            options={
              LOCALES.some((l) => l.tag === draft.locale)
                ? LOCALES.map((l) => ({ value: l.tag, label: l.label }))
                : [
                    ...LOCALES.map((l) => ({ value: l.tag, label: l.label })),
                    { value: draft.locale, label: draft.locale },
                  ]
            }
            onValueChange={(tag) => {
              const locale = LOCALES.find((l) => l.tag === tag);
              edit((c) => ({
                ...c,
                locale: tag,
                rightToLeft: locale ? locale.rtl : c.rightToLeft,
              }));
            }}
          />
        </Field>
        <Switch
          label="Right-to-left layout"
          checked={draft.rightToLeft}
          onCheckedChange={(rightToLeft) => edit((c) => ({ ...c, rightToLeft }))}
        />
      </Panel>
      <SessionsPanel />
      <OfflinePanel />
    </PageContainer>
  );
}

/**
 * User settings (/settings): density, motion, language/RTL, sessions and offline-data controls.
 * Errors: load/save failures and conflicts render inline; sessions and logo use their own typed ports.
 */
export function SettingsScreen(): ReactElement {
  const query = usePreferences();
  return (
    <QueryGate
      query={query}
      noun="preferences"
      title="Settings"
      description="Your display, language, sessions and offline preferences."
      emptyDescription="No preferences are stored for this account yet."
    >
      {(preferences) => <PreferencesEditor key={preferences.version} preferences={preferences} />}
    </QueryGate>
  );
}
