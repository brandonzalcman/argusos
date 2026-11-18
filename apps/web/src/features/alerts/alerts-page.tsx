import type { AlertChannel } from "@argus/schema";
import {
  Button,
  Checkbox,
  Field,
  Input,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  StatusPill,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@argus/ui";
import { type FormEvent, type ReactElement, useState } from "react";
import { useActiveScope } from "../live-data/active-scope.js";
import { useFeatureSources } from "../live-data/feature-sources.js";
import { LiveStatus } from "../live-data/live-status.js";
import { QueryBoundary } from "../live-data/query-boundary.js";
import { formatTimestamp } from "../live-data/time.js";
import type { AlertDeliveryRow, AlertsSource, DeliveryStatus } from "./alerts-source.js";
import {
  alertChannels,
  type ComposeDraft,
  channelLabels,
  emptyDraft,
  type Severity,
  severities,
  toggleItem,
  toRecipients,
  validateDraft,
} from "./compose.js";
import { RecipientPicker, useRecipientOptions } from "./recipient-picker.js";
import { pendingAcknowledgements, useAlertDeliveries } from "./use-alert-deliveries.js";

export interface AlertsPageProps {
  readonly source?: AlertsSource;
}

type StatusPillStatus = "stale" | "info" | "ok" | "critical";

const deliveryStatus: Record<DeliveryStatus, { pill: StatusPillStatus; label: string }> = {
  queued: { pill: "stale", label: "Queued" },
  sent: { pill: "info", label: "Sent" },
  delivered: { pill: "ok", label: "Delivered" },
  failed: { pill: "critical", label: "Failed" },
};

const severityOptions = severities.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

/**
 * Alerts: compose, channel and recipient selection, delivery status and acknowledgements.
 * Input: optional source override; defaults to the injected FeatureSources alerts port.
 * Output: a compose form and live delivery/acknowledgement regions.
 * Errors: send and acknowledge failures are announced inline; nothing is shown as sent unless the
 * source resolves.
 * Depends on: useAlertDeliveries, AlertsSource, packages/alerts and server-side authorization.
 */
export function AlertsPage({ source: sourceOverride }: AlertsPageProps): ReactElement {
  const injected = useFeatureSources().alerts;
  const source = sourceOverride ?? injected;
  const { state, isLive } = useAlertDeliveries(source);
  return (
    <PageContainer width="wide">
      <PageHeader
        title="Alerts"
        description="Compose alerts, watch delivery per channel and track acknowledgements."
        meta={<LiveStatus isLive={isLive} />}
      />
      <ComposeAlert source={source} />
      <QueryBoundary
        state={state}
        label="alert deliveries"
        empty={{
          title: "No alerts sent yet",
          description: "Alerts sent in this incident appear here with per-channel delivery status.",
        }}
      >
        {(rows) => (
          <>
            <Acknowledgements rows={pendingAcknowledgements(rows)} source={source} />
            <DeliveryTable rows={rows} />
          </>
        )}
      </QueryBoundary>
    </PageContainer>
  );
}

export function ComposeAlert({ source }: { readonly source: AlertsSource }): ReactElement {
  const scope = useActiveScope();
  const recipients = useRecipientOptions(source);
  const [draft, setDraft] = useState<ComposeDraft>(emptyDraft);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const errors = validateDraft(draft);
  const show = (field: keyof typeof errors): string | undefined =>
    submitted ? errors[field] : undefined;
  const directory = recipients.state.status === "ready" ? recipients.state.data : [];

  function submit(event: FormEvent): void {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    if (scope === null) {
      setResult({
        kind: "error",
        text: "Alert was not sent. No authenticated scope is available.",
      });
      return;
    }
    setSaving(true);
    setResult(null);
    source
      .send(scope, {
        title: draft.title.trim(),
        message: draft.message.trim(),
        severity: draft.severity,
        channels: draft.channels,
        recipients: toRecipients(draft.recipients, directory),
        acknowledgementRequired: draft.acknowledgementRequired,
      })
      .then(() => {
        setResult({ kind: "ok", text: "Alert queued for delivery." });
        setDraft(emptyDraft);
        setSubmitted(false);
      })
      .catch((error: unknown) =>
        setResult({
          kind: "error",
          text: `Alert was not sent. ${error instanceof Error ? error.message : "Unknown error."}`,
        }),
      )
      .finally(() => setSaving(false));
  }

  return (
    <Panel
      title="Compose alert"
      description="Choose recipients and channels. Delivery is recorded per channel."
    >
      <form className="grid gap-4" onSubmit={submit} noValidate aria-label="Compose alert">
        <Field label="Title" required error={show("title")}>
          <Input
            value={draft.title}
            maxLength={500}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>
        <Field label="Message" required error={show("message")}>
          <Textarea
            rows={4}
            value={draft.message}
            maxLength={10_000}
            onChange={(event) => setDraft({ ...draft, message: event.target.value })}
          />
        </Field>
        <Field label="Severity">
          <Select
            options={severityOptions}
            value={draft.severity}
            onValueChange={(value) => setDraft({ ...draft, severity: value as Severity })}
          />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-fg">Channels</legend>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {alertChannels.map((channel: AlertChannel) => (
              <Checkbox
                key={channel}
                label={channelLabels[channel]}
                checked={draft.channels.includes(channel)}
                onCheckedChange={() =>
                  setDraft({ ...draft, channels: toggleItem(draft.channels, channel) })
                }
              />
            ))}
          </div>
          {show("channels") === undefined ? null : (
            <p className="text-sm text-critical">{show("channels")}</p>
          )}
          <p className="text-sm text-fg-muted">
            Channel health is unknown until the alerts service reports it.
          </p>
        </fieldset>
        {recipients.state.status === "ready" ? (
          <RecipientPicker
            options={recipients.state.data}
            selected={draft.recipients}
            onChange={(selected) => setDraft({ ...draft, recipients: selected })}
            error={show("recipients")}
          />
        ) : (
          <div className="grid gap-2">
            <p className="text-sm font-medium text-fg">Recipients</p>
            <QueryBoundary
              state={recipients.state}
              label="recipient groups"
              empty={{
                title: "No recipient groups",
                description: "Create a position or contact group before sending an alert.",
              }}
            >
              {() => null}
            </QueryBoundary>
          </div>
        )}
        <Checkbox
          label="Require acknowledgement"
          checked={draft.acknowledgementRequired}
          onCheckedChange={(checked) =>
            setDraft({ ...draft, acknowledgementRequired: checked === true })
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={saving}>
            Send alert
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(emptyDraft);
              setSubmitted(false);
              setResult(null);
            }}
          >
            Clear
          </Button>
        </div>
        {result === null ? null : (
          <p
            role={result.kind === "error" ? "alert" : "status"}
            className={result.kind === "error" ? "text-critical" : "text-success"}
          >
            {result.text}
          </p>
        )}
      </form>
    </Panel>
  );
}

function Acknowledgements({
  rows,
  source,
}: {
  readonly rows: readonly AlertDeliveryRow[];
  readonly source: AlertsSource;
}): ReactElement {
  const scope = useActiveScope();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(new Set());

  function acknowledge(row: AlertDeliveryRow): void {
    if (scope === null) {
      setMessage({ kind: "error", text: "No authenticated scope is available." });
      return;
    }
    setMessage(null);
    source
      .acknowledge(scope, row.alert.id)
      .then(() => {
        setAcknowledged(new Set(acknowledged).add(row.alert.id));
        setMessage({ kind: "ok", text: `Acknowledged: ${row.title}` });
      })
      .catch((error: unknown) =>
        setMessage({
          kind: "error",
          text: error instanceof Error ? error.message : "Could not acknowledge.",
        }),
      );
  }

  const open = rows.filter((row) => !acknowledged.has(row.alert.id));
  return (
    <Panel title={`Awaiting acknowledgement (${open.length})`}>
      {open.length === 0 ? (
        <p className="text-fg-muted">Nothing is waiting for acknowledgement.</p>
      ) : (
        <ul className="grid gap-2">
          {open.map((row) => (
            <li key={row.alert.id} className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {row.title} <span className="text-fg-muted">· {row.alert.severity}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Acknowledge ${row.title}`}
                onClick={() => acknowledge(row)}
              >
                Acknowledge
              </Button>
            </li>
          ))}
        </ul>
      )}
      {message === null ? null : (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "mt-2 text-critical" : "mt-2 text-success"}
        >
          {message.text}
        </p>
      )}
    </Panel>
  );
}

function DeliveryTable({ rows }: { readonly rows: readonly AlertDeliveryRow[] }): ReactElement {
  const now = new Date();
  return (
    <Panel title="Delivery status" flush>
      <TableContainer>
        <Table>
          <TableCaption className="sr-only">Alert delivery status by channel</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <StatusPill
                    status={deliveryStatus[row.status].pill}
                    label={deliveryStatus[row.status].label}
                  />
                  {row.failureReason === null ? null : (
                    <span className="mt-1 block text-sm text-fg-muted">{row.failureReason}</span>
                  )}
                </TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>{channelLabels[row.channel]}</TableCell>
                <TableCell mono>{formatTimestamp(row.updatedAt, now)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Panel>
  );
}
