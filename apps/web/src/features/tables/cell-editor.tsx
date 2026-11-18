import type { FieldDefinition } from "@argus/schema";
import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Textarea,
} from "@argus/ui";
import { Paperclip, X } from "@argus/ui/icons";
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { NativeSelect, nativeControl } from "./controls.js";
import { parseEditorInput } from "./parse-input.js";
import { formatCellValue } from "./grid-model.js";
import { lookupLabel, rememberLookupLabel } from "./lookup-cache.js";
import { type AttachmentValue, type LookupOption, useTablesData } from "./tables-port.js";

export { parseEditorInput };

export interface CellEditorProps {
  readonly field: FieldDefinition;
  readonly value: unknown;
  readonly tableId: string;
  readonly recordId: string;
  readonly onCommit: (next: unknown) => void;
  readonly onCancel: () => void;
}

/** Focus an editor when it mounts (stable identity so it runs once). */
function focusOnMount(el: HTMLElement | null): void {
  el?.focus();
}

const numberLike = new Set(["number", "currency", "percent", "duration"]);

function toLocalDateTime(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) {
    return "";
  }
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

function initialText(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (field.type === "percent" && field.config.storage === "fraction" && typeof value === "number") {
    return String(Number((value * 100).toFixed(field.config.scale)));
  }
  if (field.type === "date-time") {
    return toLocalDateTime(value);
  }
  return String(value);
}

const complexTypes = new Set([
  "long-text",
  "multi-select",
  "user",
  "position",
  "link-to-record",
  "attachment",
]);

/**
 * Inline editor chosen by field type. Simple types edit in the cell (Enter/blur commits, Escape cancels,
 * invalid input is announced and never committed); lists, lookups and attachments open a popover so they
 * are never clipped by the virtualized grid.
 */
export function CellEditor(props: CellEditorProps): ReactElement {
  if (complexTypes.has(props.field.type)) {
    return <PopoverEditor {...props} />;
  }
  return <InlineEditor {...props} />;
}

function InlineEditor({ field, value, onCommit, onCancel }: CellEditorProps): ReactElement {
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => initialText(field, value));
  const doneRef = useRef(false);

  const finish = (next: unknown): void => {
    if (!doneRef.current) {
      doneRef.current = true;
      onCommit(next);
    }
  };
  const cancel = (): void => {
    if (!doneRef.current) {
      doneRef.current = true;
      onCancel();
    }
  };
  const tryCommit = (raw: string): void => {
    if (doneRef.current) {
      return;
    }
    const parsed = parseEditorInput(field, raw);
    if (parsed.ok) {
      finish(parsed.value);
    } else {
      setError(parsed.message);
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter") {
      event.preventDefault();
      tryCommit(draft);
    }
  };
  const message = error ? (
    <span id={errorId} role="alert" className="shrink-0 text-xs text-critical">
      {error}
    </span>
  ) : null;
  const small = "h-7 px-2 text-sm";

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm" onKeyDown={onKeyDown}>
        <input
          type="checkbox"
          ref={focusOnMount}
          aria-label={field.name}
          className="size-4 accent-accent"
          defaultChecked={value === true}
          onChange={(e) => finish(e.target.checked)}
          onBlur={cancel}
        />
        {field.config.trueLabel} / {field.config.falseLabel}
      </label>
    );
  }
  if (field.type === "single-select" || field.type === "status") {
    const options = field.config.options.filter((o) => !o.archived || o.id === value);
    return (
      <NativeSelect
        ref={focusOnMount}
        aria-label={field.name}
        className={small}
        defaultValue={typeof value === "string" ? value : ""}
        onKeyDown={onKeyDown}
        onChange={(e) => finish(e.target.value === "" ? null : e.target.value)}
        onBlur={cancel}
      >
        <option value="">{field.required ? "Choose…" : "(empty)"}</option>
        {[...options]
          .sort((a, b) => a.order - b.order)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
      </NativeSelect>
    );
  }
  const inputType = numberLike.has(field.type)
    ? "number"
    : field.type === "date"
      ? "date"
      : field.type === "date-time"
        ? "datetime-local"
        : field.type === "email"
          ? "email"
          : field.type === "url"
            ? "url"
            : field.type === "phone"
              ? "tel"
              : "text";
  return (
    <>
      <input
        ref={focusOnMount}
        aria-label={field.name}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        className={`${nativeControl} ${small} ${inputType === "number" ? "text-end font-mono" : ""}`}
        type={inputType}
        step={inputType === "number" ? "any" : undefined}
        value={draft}
        onKeyDown={onKeyDown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => tryCommit(draft)}
      />
      {message}
    </>
  );
}

function PopoverEditor({ field, value, tableId, recordId, onCommit, onCancel }: CellEditorProps): ReactElement {
  const [draft, setDraft] = useState<unknown>(value ?? null);
  const doneRef = useRef(false);
  const commit = (next: unknown): void => {
    if (!doneRef.current) {
      doneRef.current = true;
      onCommit(next);
    }
  };
  const cancel = (): void => {
    if (!doneRef.current) {
      doneRef.current = true;
      onCancel();
    }
  };
  let body: ReactNode;
  switch (field.type) {
    case "long-text":
      body = (
        <Textarea
          aria-label={field.name}
          rows={5}
          value={typeof draft === "string" ? draft : ""}
          onChange={(e) => setDraft(e.target.value)}
        />
      );
      break;
    case "multi-select":
      body = (
        <MultiSelectBody
          field={field}
          selected={Array.isArray(draft) ? draft.map(String) : []}
          onChange={setDraft}
        />
      );
      break;
    case "user":
    case "position":
      body = (
        <LookupBody
          field={field}
          kind={field.type}
          multiple={false}
          tableId={tableId}
          selected={typeof draft === "string" ? [draft] : []}
          onChange={(ids) => setDraft(ids[0] ?? null)}
        />
      );
      break;
    case "link-to-record":
      body = (
        <LookupBody
          field={field}
          kind="link"
          multiple={field.config.allowMultiple}
          tableId={tableId}
          selected={Array.isArray(draft) ? draft.map(String) : typeof draft === "string" ? [draft] : []}
          onChange={(ids) => setDraft(field.config.allowMultiple ? ids : (ids[0] ?? null))}
        />
      );
      break;
    case "attachment":
      body = (
        <AttachmentBody
          field={field}
          tableId={tableId}
          recordId={recordId}
          files={Array.isArray(draft) ? (draft as AttachmentValue[]) : []}
          onChange={setDraft}
        />
      );
      break;
    default:
      body = <p className="text-sm text-fg-muted">Not editable inline.</p>;
  }
  const complete = (): void => {
    const empty = draft === null || draft === "" || (Array.isArray(draft) && draft.length === 0);
    if (empty && field.required) {
      return;
    }
    commit(empty ? null : draft);
  };
  return (
    <Popover open onOpenChange={(open) => !open && cancel()}>
      <PopoverAnchor asChild>
        <span className="min-w-0 flex-1 truncate text-fg-muted">{formatCellValue(field, value) || "…"}</span>
      </PopoverAnchor>
      <PopoverContent aria-label={`Edit ${field.name}`} className="w-80 max-w-[90vw]">
        <div
          className="grid gap-3"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              cancel();
            }
          }}
        >
          <p className="text-sm font-semibold text-fg">{field.name}</p>
          {body}
          {field.required && (draft === null || (Array.isArray(draft) && draft.length === 0)) ? (
            <p role="alert" className="text-xs text-critical">
              {field.name} is required.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={complete}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectBody({
  field,
  selected,
  onChange,
}: {
  readonly field: Extract<FieldDefinition, { type: "multi-select" }>;
  readonly selected: readonly string[];
  readonly onChange: (next: string[]) => void;
}): ReactElement {
  const max = field.config.maximumSelections;
  return (
    <fieldset className="grid max-h-60 gap-2 overflow-auto border-0 p-0">
      <legend className="sr-only">{field.name}</legend>
      {[...field.config.options]
        .sort((a, b) => a.order - b.order)
        .filter((o) => !o.archived || selected.includes(o.id))
        .map((o) => {
          const checked = selected.includes(o.id);
          return (
            <Checkbox
              key={o.id}
              label={o.label}
              checked={checked}
              disabled={!checked && max !== null && selected.length >= max}
              onCheckedChange={(state) =>
                onChange(state === true ? [...selected, o.id] : selected.filter((id) => id !== o.id))
              }
            />
          );
        })}
    </fieldset>
  );
}

type LookupState =
  | { readonly state: "idle" | "loading" }
  | { readonly state: "ready"; readonly options: readonly LookupOption[] }
  | { readonly state: "error"; readonly message: string };

function LookupBody({
  field,
  kind,
  multiple,
  tableId,
  selected,
  onChange,
}: {
  readonly field: FieldDefinition;
  readonly kind: "user" | "position" | "link";
  readonly multiple: boolean;
  readonly tableId: string;
  readonly selected: readonly string[];
  readonly onChange: (ids: string[]) => void;
}): ReactElement {
  const port = useTablesData();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupState>({ state: "idle" });

  useEffect(() => {
    let active = true;
    setResult({ state: "loading" });
    const timer = setTimeout(() => {
      port
        .searchLookupOptions({ tableId, fieldId: field.id, kind, query: query.trim(), limit: 20 })
        .then((options) => {
          if (active) {
            for (const o of options) {
              rememberLookupLabel(o.id, o.label);
            }
            setResult({ state: "ready", options });
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setResult({ state: "error", message: error instanceof Error ? error.message : "Search failed." });
          }
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [port, tableId, field.id, kind, query]);

  const toggle = (id: string): void => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange(multiple ? [...selected, id] : [id]);
    }
  };

  return (
    <div className="grid gap-2">
      {selected.length > 0 ? (
        <ul aria-label="Selected" className="m-0 flex list-none flex-wrap gap-1 p-0">
          {selected.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-sunken px-2 py-0.5 text-sm"
            >
              {lookupLabel(id)}
              <button
                type="button"
                aria-label={`Remove ${lookupLabel(id)}`}
                className="rounded-sm text-fg-muted hover:text-fg"
                onClick={() => toggle(id)}
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        aria-label={`Search ${field.name}`}
        aria-controls={listId}
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div id={listId} className="max-h-48 overflow-auto" aria-live="polite">
        {result.state === "loading" ? <p className="text-sm text-fg-muted">Searching…</p> : null}
        {result.state === "error" ? (
          <p role="alert" className="text-sm text-critical">
            Search unavailable: {result.message}
          </p>
        ) : null}
        {result.state === "ready" && result.options.length === 0 ? (
          <p className="text-sm text-fg-muted">No matches.</p>
        ) : null}
        {result.state === "ready" ? (
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {result.options.map((o) => {
              const on = selected.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-start text-sm hover:bg-surface-hover aria-pressed:bg-accent-subtle aria-pressed:font-medium"
                    onClick={() => toggle(o.id)}
                  >
                    <span>{o.label}</span>
                    {o.detail ? <span className="text-xs text-fg-muted">{o.detail}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1_048_576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1_048_576).toFixed(1)} MB`;
}

function AttachmentBody({
  field,
  tableId,
  recordId,
  files,
  onChange,
}: {
  readonly field: Extract<FieldDefinition, { type: "attachment" }>;
  readonly tableId: string;
  readonly recordId: string;
  readonly files: readonly AttachmentValue[];
  readonly onChange: (next: AttachmentValue[]) => void;
}): ReactElement {
  const port = useTablesData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { maximumFiles, maximumBytesPerFile, allowedMimeTypes } = field.config;

  const add = async (file: File): Promise<void> => {
    setError(null);
    if (maximumFiles !== null && files.length >= maximumFiles) {
      setError(`At most ${maximumFiles} files.`);
      return;
    }
    if (file.size > maximumBytesPerFile) {
      setError(`${file.name} is larger than ${formatBytes(maximumBytesPerFile)}.`);
      return;
    }
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
      setError(`${file.type || "This file type"} is not allowed.`);
      return;
    }
    setBusy(true);
    try {
      const stored = await port.uploadAttachment({ tableId, recordId, fieldId: field.id, file });
      onChange([...files, stored]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2">
      {files.length === 0 ? <p className="text-sm text-fg-muted">No files attached.</p> : null}
      <ul className="m-0 grid list-none gap-1 p-0">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <Paperclip aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 font-mono text-xs text-fg-muted">{formatBytes(f.sizeBytes)}</span>
            </span>
            <button
              type="button"
              aria-label={`Remove ${f.name}`}
              className="rounded-sm text-fg-muted hover:text-fg"
              onClick={() => onChange(files.filter((x) => x.id !== f.id))}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Add file</span>
        <input
          type="file"
          disabled={busy}
          accept={allowedMimeTypes.length > 0 ? allowedMimeTypes.join(",") : undefined}
          className="text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) {
              void add(file);
            }
          }}
        />
      </label>
      {busy ? (
        <p role="status" className="text-sm text-fg-muted">
          Uploading…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}
