import type { BlockType, ComponentProp } from "@argus/schema";

/**
 * Starter sources for "eject block to custom component". Plain strings, never evaluated by the app;
 * they compile with the sandbox compiler and use only `react` and `@argus/component-sdk`.
 * They contain no operational data: everything comes from props and bridge hooks, and empty states
 * explain what to configure. Field values are keyed by field id in `record.values`.
 */
export interface BlockTemplate {
  readonly source: string;
  readonly props: ComponentProp[];
}

type PropType = ComponentProp["type"];

function prop(
  key: string,
  label: string,
  type: PropType,
  extra: {
    readonly required?: boolean;
    readonly description?: string;
    readonly defaultValue?: ComponentProp["defaultValue"];
  } = {},
): ComponentProp {
  return {
    key,
    label,
    description: extra.description ?? null,
    type,
    required: extra.required ?? false,
    defaultValue: extra.defaultValue ?? null,
    options: [],
  };
}

const tableProp = prop("table_id", "Table", "table", { required: true });
const incidentNote =
  "Incident-scoped tables are limited to the incidents granted to this component.";

/** Shared helper source: renders any field value as readable text. */
const FORMAT = `function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
`;

const HEADER = (names: string): string => `import { ${names} } from "@argus/component-sdk";\n`;

const CHOOSE_TABLE =
  '<EmptyState title="Choose a table" description="Set the Table prop and grant read access to it." />';

/** Shared render of loading/error states for hook results. */
const STATES = `  if (result.status === "error") {
    return (
      <Card>
        <Text tone="critical">
          {result.error?.code === "capability-denied"
            ? "This component does not have access to that data."
            : "Could not load data: " + (result.error?.message ?? "unknown error")}
        </Text>
      </Card>
    );
  }
`;

const blankSource =
  HEADER("Card, Heading, Stack, Text, useProps") +
  `
type Props = { title?: string };

export default function Component() {
  const { title } = useProps<Props>();
  return (
    <Card>
      <Stack gap={2}>
        <Heading level={3}>{title || "Custom component"}</Heading>
        <Text tone="muted">Edit this source to build your component.</Text>
      </Stack>
    </Card>
  );
}
`;

const recordTable = (extraProps: string, filter: string): string =>
  HEADER("Card, EmptyState, Text, useProps, useRecords") +
  FORMAT +
  `
type Props = { tableId?: string; fieldIds?: string; limit?: number${extraProps} };

export default function RecordTable() {
  const props = useProps<Props>();
  const columns = (props.field_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
  const result = useRecords(props.table_id ? { tableId: props.table_id, limit: props.limit || 50 } : null);
${filter}
  if (!props.table_id) return ${CHOOSE_TABLE};
${STATES}  if (result.loading) return <Text tone="muted">Loading...</Text>;
  if (rows.length === 0) return <EmptyState title="No records" />;
  return (
    <Card padding={0}>
      <table>
        <thead>
          <tr>
            {columns.length === 0 ? <th>Record</th> : columns.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr key={record.id}>
              {columns.length === 0 ? (
                <td>{record.id}</td>
              ) : (
                columns.map((c) => <td key={c}>{formatValue(record.values[c])}</td>)
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
`;

const fieldIdsProp = prop("field_ids", "Field IDs", "string", {
  description: `Comma-separated field IDs to show as columns. ${incidentNote}`,
});
const limitProp = prop("limit", "Row limit", "number", { defaultValue: 50 });

const RAW_TEMPLATES: Record<BlockType, BlockTemplate> = {
  "field-input": {
    source:
      HEADER("Button, Card, EmptyState, Stack, Text, updateRecord, useProps, useRecord") +
      FORMAT +
      `
type Props = { tableId?: string; recordId?: string; fieldId?: string; label?: string };

export default function FieldInput() {
  const props = useProps<Props>();
  const result = useRecord(props.table_id, props.record_id);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!props.table_id || !props.record_id || !props.field_id) {
    return <EmptyState title="Configure the field" description="Set the Table, Record ID and Field props." />;
  }
${STATES}  const record = result.data;
  if (result.loading) return <Text tone="muted">Loading...</Text>;
  if (!record) return <EmptyState title="Record not found" />;

  const current = formatValue(record.values[props.field_id]);
  const value = draft ?? current;

  async function save() {
    if (!record || !props.table_id || !props.record_id || !props.field_id) return;
    setSaving(true);
    setError(null);
    try {
      await updateRecord({ tableId: props.table_id, recordId: props.record_id }, { [props.field_id]: value }, record.version);
      setDraft(null);
      result.refresh();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError(err.code === "version-conflict" ? "The record changed. Reload and try again." : err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Stack gap={2}>
        <label htmlFor="field-input">
          <Text weight="medium">{props.label || props.field_id}</Text>
        </label>
        <input id="field-input" value={value} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 32 }} />
        {error ? <Text tone="critical">{error}</Text> : null}
        <Stack direction="row" gap={2}>
          <Button variant="primary" disabled={saving || draft === null} onClick={save}>Save</Button>
          <Button disabled={draft === null} onClick={() => setDraft(null)}>Reset</Button>
        </Stack>
      </Stack>
    </Card>
  );
}
`,
    props: [
      tableProp,
      prop("record_id", "Record ID", "string", { required: true }),
      prop("field_id", "Field", "field", { required: true }),
      prop("label", "Label", "string"),
    ],
  },

  "field-display": {
    source:
      HEADER("Card, EmptyState, Stack, Text, useProps, useRecord") +
      FORMAT +
      `
type Props = { tableId?: string; recordId?: string; fieldId?: string; label?: string };

export default function FieldDisplay() {
  const props = useProps<Props>();
  const result = useRecord(props.table_id, props.record_id);
  if (!props.table_id || !props.record_id || !props.field_id) {
    return <EmptyState title="Configure the field" description="Set the Table, Record ID and Field props." />;
  }
${STATES}  if (result.loading) return <Text tone="muted">Loading...</Text>;
  if (!result.data) return <EmptyState title="Record not found" />;
  const text = formatValue(result.data.values[props.field_id]);
  return (
    <Stack gap={1}>
      <Text tone="muted" size="sm">{props.label || props.field_id}</Text>
      <Text size="lg">{text || "-"}</Text>
    </Stack>
  );
}
`,
    props: [
      tableProp,
      prop("record_id", "Record ID", "string", { required: true }),
      prop("field_id", "Field", "field", { required: true }),
      prop("label", "Label", "string"),
    ],
  },

  "record-list": {
    source: recordTable("", "  const rows = result.data;"),
    props: [tableProp, fieldIdsProp, limitProp],
  },

  "related-records": {
    source: recordTable(
      "; relationFieldId?: string; parentRecordId?: string",
      "  const rows = result.data.filter((r) => !props.relation_field_id || formatValue(r.values[props.relation_field_id]) === props.parent_record_id);",
    ),
    props: [
      tableProp,
      fieldIdsProp,
      limitProp,
      prop("relation_field_id", "Relation field", "field", {
        description: "Field on the related table that points at the parent record.",
      }),
      prop("parent_record_id", "Parent record ID", "string"),
    ],
  },

  stat: {
    source:
      HEADER("Card, EmptyState, Stack, Text, useProps, useRecords") +
      `
type Props = { tableId?: string; label?: string };

export default function Stat() {
  const props = useProps<Props>();
  const result = useRecords(props.table_id ? { tableId: props.table_id } : null);
  if (!props.table_id) return ${CHOOSE_TABLE};
${STATES}  return (
    <Card>
      <Stack gap={1}>
        <Text tone="muted" size="sm">{props.label || "Records"}</Text>
        <Text size="lg" weight="bold">{result.loading ? "..." : String(result.data.length)}</Text>
      </Stack>
    </Card>
  );
}
`,
    props: [tableProp, prop("label", "Label", "string", { defaultValue: "Records" })],
  },

  chart: {
    source:
      HEADER("Card, EmptyState, Stack, Text, useProps, useRecords") +
      FORMAT +
      `
type Props = { tableId?: string; groupFieldId?: string; title?: string };

export default function BarChart() {
  const props = useProps<Props>();
  const result = useRecords(props.table_id ? { tableId: props.table_id } : null);
  if (!props.table_id || !props.group_field_id) {
    return <EmptyState title="Configure the chart" description="Set the Table and Group field props." />;
  }
${STATES}  if (result.loading) return <Text tone="muted">Loading...</Text>;
  const counts = new Map<string, number>();
  for (const record of result.data) {
    const key = formatValue(record.values[props.group_field_id]) || "(empty)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (entries.length === 0) return <EmptyState title="No data" />;
  return (
    <Card>
      <Stack gap={2}>
        {props.title ? <Text weight="medium">{props.title}</Text> : null}
        {entries.map(([label, n]) => (
          <div key={label} role="img" aria-label={label + ": " + n}>
            <Stack direction="row" justify="space-between"><Text size="sm">{label}</Text><Text size="sm" mono>{String(n)}</Text></Stack>
            <div style={{ height: 8, borderRadius: 4, background: "var(--argus-color-surface-sunken, #eee)" }}>
              <div style={{ height: 8, borderRadius: 4, width: (n / max) * 100 + "%", background: "var(--argus-color-accent, #2563eb)" }} />
            </div>
          </div>
        ))}
      </Stack>
    </Card>
  );
}
`,
    props: [
      tableProp,
      prop("group_field_id", "Group by field", "field", { required: true }),
      prop("title", "Title", "string"),
    ],
  },

  map: {
    source:
      HEADER("Card, EmptyState, Text, useProps, useRecords") +
      FORMAT +
      `
// Map tiles need network access, which the sandbox does not allow. This starter lists the
// locations as text; draw your own canvas/SVG map from the coordinates if you need a picture.
type Props = { tableId?: string; locationFieldId?: string; labelFieldId?: string };

export default function LocationList() {
  const props = useProps<Props>();
  const result = useRecords(props.table_id ? { tableId: props.table_id } : null);
  if (!props.table_id || !props.location_field_id) {
    return <EmptyState title="Configure the locations" description="Set the Table and Location field props." />;
  }
${STATES}  if (result.loading) return <Text tone="muted">Loading...</Text>;
  const rows = result.data.filter((r) => r.values[props.location_field_id as string] != null);
  if (rows.length === 0) return <EmptyState title="No locations" />;
  return (
    <Card padding={0}>
      <table>
        <thead><tr><th>Record</th><th>Location</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{props.label_field_id ? formatValue(r.values[props.label_field_id]) : r.id}</td>
              <td>{formatValue(r.values[props.location_field_id as string])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
`,
    props: [
      tableProp,
      prop("location_field_id", "Location field", "field", { required: true }),
      prop("label_field_id", "Label field", "field"),
    ],
  },

  timeline: {
    source:
      HEADER("Card, EmptyState, Stack, Text, useProps, useRecords") +
      FORMAT +
      `
type Props = { tableId?: string; timeFieldId?: string; titleFieldId?: string };

export default function Timeline() {
  const props = useProps<Props>();
  const result = useRecords(props.table_id ? { tableId: props.table_id } : null);
  if (!props.table_id || !props.time_field_id) {
    return <EmptyState title="Configure the timeline" description="Set the Table and Time field props." />;
  }
${STATES}  if (result.loading) return <Text tone="muted">Loading...</Text>;
  const timeField = props.time_field_id;
  const rows = [...result.data].sort((a, b) => formatValue(b.values[timeField]).localeCompare(formatValue(a.values[timeField])));
  if (rows.length === 0) return <EmptyState title="No events" />;
  return (
    <Stack gap={2}>
      {rows.map((r) => (
        <Card key={r.id}>
          <Stack gap={1}>
            <Text size="sm" tone="muted" mono>{formatValue(r.values[timeField])}</Text>
            <Text>{props.title_field_id ? formatValue(r.values[props.title_field_id]) : r.id}</Text>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
`,
    props: [
      tableProp,
      prop("time_field_id", "Time field", "field", { required: true }),
      prop("title_field_id", "Title field", "field"),
    ],
  },

  "rich-text": {
    source:
      HEADER("EmptyState, Stack, Text, useProps") +
      `
// Text is rendered as plain text paragraphs; HTML is never interpreted.
type Props = { text?: string };

export default function RichText() {
  const { text } = useProps<Props>();
  const paragraphs = (text || "").split(/\\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return <EmptyState title="No text" description="Set the Text prop." />;
  return (
    <Stack gap={2}>
      {paragraphs.map((p, i) => <Text key={i}>{p}</Text>)}
    </Stack>
  );
}
`,
    props: [prop("text", "Text", "text", { required: true })],
  },

  image: {
    source:
      HEADER("EmptyState, Text, useProps") +
      `
// The sandbox only allows data: and blob: image sources (no network). Pass a data URL in the URL prop.
type Props = { url?: string; alt?: string };

export default function ImageBlock() {
  const { url, alt } = useProps<Props>();
  if (!url) return <EmptyState title="No image" description="Set the URL prop to a data: URL." />;
  if (!/^(data:image\\/|blob:)/.test(url)) {
    return <Text tone="warning">Only data: and blob: image URLs can be displayed in the sandbox.</Text>;
  }
  return <img src={url} alt={alt || ""} style={{ maxWidth: "100%", display: "block", borderRadius: "var(--argus-radius-md, 6px)" }} />;
}
`,
    props: [
      prop("url", "Image URL (data:)", "url", { required: true }),
      prop("alt", "Alt text", "string"),
    ],
  },

  button: {
    source:
      HEADER("Button, EmptyState, Stack, Text, updateRecord, useProps, useRecord") +
      `
// Sets one field on one record when clicked, using the record's current version.
type Props = { label?: string; tableId?: string; recordId?: string; fieldId?: string; value?: string };

export default function ActionButton() {
  const props = useProps<Props>();
  const result = useRecord(props.table_id, props.record_id);
  const [message, setMessage] = React.useState<string | null>(null);
  if (!props.table_id || !props.record_id || !props.field_id) {
    return <EmptyState title="Configure the button" description="Set the Table, Record ID and Field props." />;
  }
  async function run() {
    const record = result.data;
    if (!record || !props.table_id || !props.record_id || !props.field_id) return;
    setMessage(null);
    try {
      await updateRecord({ tableId: props.table_id, recordId: props.record_id }, { [props.field_id]: props.value ?? "" }, record.version);
      result.refresh();
      setMessage("Done.");
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setMessage(err.code === "capability-denied" ? "Not allowed." : err.message || "Failed.");
    }
  }
  return (
    <Stack gap={2}>
      <Button variant="primary" disabled={!result.data} onClick={run}>{props.label || "Run"}</Button>
      {message ? <Text size="sm" tone="muted">{message}</Text> : null}
    </Stack>
  );
}
`,
    props: [
      prop("label", "Label", "string", { defaultValue: "Run" }),
      tableProp,
      prop("record_id", "Record ID", "string", { required: true }),
      prop("field_id", "Field", "field", { required: true }),
      prop("value", "Value to set", "string"),
    ],
  },

  tabs: {
    source:
      HEADER("Card, EmptyState, Stack, Text, useProps") +
      `
// Add the content of each tab in the panel below, keyed by the tab label.
type Props = { labels?: string };

export default function Tabs() {
  const { labels } = useProps<Props>();
  const tabs = (labels || "").split(",").map((s) => s.trim()).filter(Boolean);
  const [selected, setSelected] = React.useState(0);
  if (tabs.length === 0) return <EmptyState title="No tabs" description="Set the Labels prop (comma separated)." />;
  const active = Math.min(selected, tabs.length - 1);
  return (
    <Stack gap={2}>
      <div role="tablist" style={{ display: "flex", gap: 4 }}>
        {tabs.map((label, i) => (
          <button
            key={label}
            role="tab"
            aria-selected={i === active}
            onClick={() => setSelected(i)}
            style={{ font: "inherit", padding: "4px 12px", border: 0, borderBottom: i === active ? "2px solid var(--argus-color-accent, #2563eb)" : "2px solid transparent", background: "transparent", color: "inherit", cursor: "pointer" }}
          >
            {label}
          </button>
        ))}
      </div>
      <Card>
        <div role="tabpanel"><Text tone="muted">Content for "{tabs[active]}" goes here.</Text></div>
      </Card>
    </Stack>
  );
}
`,
    props: [
      prop("labels", "Tab labels", "string", { required: true, description: "Comma-separated." }),
    ],
  },

  section: {
    source:
      HEADER("Card, Heading, Stack, Text, useProps") +
      `
type Props = { title?: string; body?: string };

export default function Section() {
  const { title, body } = useProps<Props>();
  return (
    <Card>
      <Stack gap={2}>
        {title ? <Heading level={3}>{title}</Heading> : null}
        {body ? <Text>{body}</Text> : <Text tone="muted">Add content to this section.</Text>}
      </Stack>
    </Card>
  );
}
`,
    props: [prop("title", "Title", "string"), prop("body", "Body", "text")],
  },

  divider: {
    source: `export default function Divider() {
  return <hr style={{ border: 0, borderTop: "1px solid var(--argus-color-border, #e5e7eb)", margin: "8px 0" }} />;
}
`,
    props: [],
  },

  embed: {
    source:
      HEADER("Card, Stack, Text, useProps") +
      `
// Custom components cannot load external pages (the sandbox allows no frames or network).
type Props = { url?: string };

export default function EmbedNotice() {
  const { url } = useProps<Props>();
  return (
    <Card>
      <Stack gap={1}>
        <Text weight="medium">External embeds are not available inside custom components.</Text>
        {url ? <Text tone="muted" mono size="sm">{url}</Text> : <Text tone="muted">Set the URL prop to show a reference.</Text>}
      </Stack>
    </Card>
  );
}
`,
    props: [prop("url", "URL", "url")],
  },

  comments: {
    source:
      HEADER("Card, Text") +
      `
// TODO: the sandbox bridge has no comments API yet (only records). This scaffold says so.
export default function Comments() {
  return (
    <Card>
      <Text tone="muted">Comments are not available to custom components yet.</Text>
    </Card>
  );
}
`,
    props: [],
  },

  checklist: {
    source:
      HEADER("Card, EmptyState, Stack, Text, updateRecord, useProps, useRecords") +
      FORMAT +
      `
// One row per record: a title field and a boolean "done" field that can be toggled.
type Props = { tableId?: string; titleFieldId?: string; doneFieldId?: string };

export default function Checklist() {
  const props = useProps<Props>();
  const result = useRecords(props.table_id ? { tableId: props.table_id } : null);
  const [error, setError] = React.useState<string | null>(null);
  if (!props.table_id || !props.title_field_id || !props.done_field_id) {
    return <EmptyState title="Configure the checklist" description="Set the Table, Title field and Done field props." />;
  }
${STATES}  if (result.loading) return <Text tone="muted">Loading...</Text>;
  if (result.data.length === 0) return <EmptyState title="Nothing to check off" />;
  async function toggle(id: string, version: number, done: boolean) {
    if (!props.table_id || !props.done_field_id) return;
    setError(null);
    try {
      await updateRecord({ tableId: props.table_id, recordId: id }, { [props.done_field_id]: !done }, version);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError(err.code === "version-conflict" ? "Changed elsewhere; try again." : err.message || "Could not update.");
    }
  }
  return (
    <Card>
      <Stack gap={2}>
        {result.data.map((r) => {
          const done = r.values[props.done_field_id as string] === true;
          return (
            <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={done} onChange={() => toggle(r.id, r.version, done)} />
              <Text>{formatValue(r.values[props.title_field_id as string])}</Text>
            </label>
          );
        })}
        {error ? <Text tone="critical">{error}</Text> : null}
      </Stack>
    </Card>
  );
}
`,
    props: [
      tableProp,
      prop("title_field_id", "Title field", "field", { required: true }),
      prop("done_field_id", "Done field (boolean)", "field", { required: true }),
    ],
  },

  "attachment-gallery": {
    source:
      HEADER("Card, Text") +
      `
// TODO: the sandbox bridge has no file API yet (only records), so attachments cannot be listed here.
export default function AttachmentGallery() {
  return (
    <Card>
      <Text tone="muted">Attachments are not available to custom components yet.</Text>
    </Card>
  );
}
`,
    props: [],
  },

  countdown: {
    source:
      HEADER("Card, EmptyState, Stack, Text, useProps") +
      `
type Props = { label?: string; targetIso?: string };

function remaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (d > 0 ? d + "d " : "") + pad(h) + ":" + pad(m) + ":" + pad(s);
}

export default function Countdown() {
  const { label, targetIso } = useProps<Props>();
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = targetIso ? Date.parse(targetIso) : NaN;
  if (Number.isNaN(target)) {
    return <EmptyState title="Set a target time" description="Set the Target prop to an ISO date-time." />;
  }
  return (
    <Card>
      <Stack gap={1}>
        <Text tone="muted" size="sm">{label || "Time remaining"}</Text>
        <Text size="lg" weight="bold" mono>{remaining(target - now)}</Text>
      </Stack>
    </Card>
  );
}
`,
    props: [
      prop("label", "Label", "string"),
      prop("target_iso", "Target (ISO date-time)", "string", { required: true }),
    ],
  },

  weather: {
    source:
      HEADER("Card, Text") +
      `
// TODO: weather needs network access, which the sandbox does not allow; provide data via a table.
export default function Weather() {
  return (
    <Card>
      <Text tone="muted">Weather data cannot be fetched from inside a custom component.</Text>
    </Card>
  );
}
`,
    props: [],
  },

  "board-embed": {
    source:
      HEADER("Card, Stack, Text, useProps") +
      `
// A custom component cannot embed another board; place the board-embed block on the page instead.
type Props = { boardId?: string };

export default function BoardEmbedNotice() {
  const { boardId } = useProps<Props>();
  return (
    <Card>
      <Stack gap={1}>
        <Text weight="medium">Boards cannot be embedded inside custom components.</Text>
        <Text tone="muted" mono size="sm">{boardId || "No board selected"}</Text>
      </Stack>
    </Card>
  );
}
`,
    props: [prop("board_id", "Board", "board")],
  },

  "link-list": {
    source:
      HEADER("Card, EmptyState, Stack, Text, useProps") +
      `
// One link per line as "Label | address". The sandbox cannot navigate, so addresses are shown as text.
type Props = { links?: string };

export default function LinkList() {
  const { links } = useProps<Props>();
  const rows = (links || "")
    .split("\\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter((parts) => parts[0]);
  if (rows.length === 0) return <EmptyState title="No links" description="Set the Links prop." />;
  return (
    <Card>
      <Stack gap={2}>
        {rows.map(([label, target], i) => (
          <Stack key={i} gap={1}>
            <Text weight="medium">{label}</Text>
            {target ? <Text tone="muted" size="sm" mono>{target}</Text> : null}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
`,
    props: [prop("links", "Links", "text", { description: 'One per line: "Label | address".' })],
  },

  "custom-component": { source: blankSource, props: [prop("title", "Title", "string")] },
};

/** Templates that call `React.*` get an explicit import so the source type-checks in an editor. */
const TEMPLATES = Object.fromEntries(
  Object.entries(RAW_TEMPLATES).map(([type, template]) => [
    type,
    template.source.includes("React.")
      ? { ...template, source: `import * as React from "react";\n${template.source}` }
      : template,
  ]),
) as Record<BlockType, BlockTemplate>;

/** Starter used for "New component" (not ejected from a block). */
export const blankComponentTemplate: BlockTemplate = {
  source: blankSource,
  props: [prop("title", "Title", "string", { defaultValue: "Custom component" })],
};

/** Readable starter TSX plus prop declarations reproducing a built-in block's intent. */
export function getBlockTemplate(blockType: BlockType): { source: string; props: ComponentProp[] } {
  const template = TEMPLATES[blockType];
  return {
    source: template.source,
    props: template.props.map((p) => ({ ...p, options: [...p.options] })),
  };
}

export const BLOCK_TEMPLATE_TYPES: readonly BlockType[] = Object.keys(TEMPLATES) as BlockType[];
