import type { FieldDefinition, FieldTypeId, SelectOption, TableDefinition } from "@argus/schema";
import type { ReactElement, ReactNode } from "react";
import { useId } from "react";
import { newDraftId, slugifyKey, withFieldType } from "./designer-model.js";
import { getFieldType, listFieldTypes } from "./field-catalog.js";
import "./tables.css";

export interface FieldEditorProps {
  readonly field: FieldDefinition;
  /** True for a field not yet published: its key and type are freely editable. */
  readonly isNew: boolean;
  readonly draftFields: readonly FieldDefinition[];
  /** Authorized catalog, used for relation targets and rollup/lookup target fields. */
  readonly tables: readonly TableDefinition[];
  readonly issues: readonly string[];
  readonly onChange: (next: FieldDefinition) => void;
}

interface RowProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly children: (id: string, describedBy: string | undefined) => ReactNode;
}

function Row({ label, hint, children }: RowProps): ReactElement {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="tbl-form-row">
      <label htmlFor={id}>{label}</label>
      {children(id, hint ? hintId : undefined)}
      {hint ? (
        <small id={hintId} className="argus-muted">
          {hint}
        </small>
      ) : null}
    </div>
  );
}

function nullableNumber(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function OptionsEditor({
  options,
  onChange,
}: {
  readonly options: readonly SelectOption[];
  readonly onChange: (next: SelectOption[]) => void;
}): ReactElement {
  const ordered = [...options].sort((a, b) => a.order - b.order);
  const commit = (next: SelectOption[]): void =>
    onChange(next.map((o, index) => ({ ...o, order: index })));
  return (
    <fieldset className="tbl-options">
      <legend>Options</legend>
      {ordered.length === 0 ? <p className="argus-muted">No options yet.</p> : null}
      <ol>
        {ordered.map((option, index) => (
          <li key={option.id} className="argus-cluster">
            <input
              aria-label={`Option ${index + 1} label`}
              className="tbl-input"
              value={option.label}
              maxLength={200}
              onChange={(e) =>
                commit(
                  ordered.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)),
                )
              }
            />
            <input
              type="color"
              aria-label={`Option ${index + 1} colour`}
              value={option.color ?? "#64748b"}
              onChange={(e) =>
                commit(
                  ordered.map((o) => (o.id === option.id ? { ...o, color: e.target.value } : o)),
                )
              }
            />
            <label>
              <input
                type="checkbox"
                checked={option.archived}
                onChange={(e) =>
                  commit(
                    ordered.map((o) =>
                      o.id === option.id ? { ...o, archived: e.target.checked } : o,
                    ),
                  )
                }
              />{" "}
              Archived
            </label>
            <button
              type="button"
              className="tbl-button"
              disabled={index === 0}
              onClick={() => {
                const next = [...ordered];
                const [moved] = next.splice(index, 1);
                if (moved) {
                  next.splice(index - 1, 0, moved);
                }
                commit(next);
              }}
            >
              Move option {index + 1} up
            </button>
            <button
              type="button"
              className="tbl-button"
              onClick={() => commit(ordered.filter((o) => o.id !== option.id))}
            >
              Remove option {index + 1}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="tbl-button"
        onClick={() =>
          commit([
            ...ordered,
            { id: newDraftId(), label: "", color: null, order: ordered.length, archived: false },
          ])
        }
      >
        Add option
      </button>
    </fieldset>
  );
}

function ConfigForm({
  field,
  draftFields,
  tables,
  onChange,
}: Pick<FieldEditorProps, "field" | "draftFields" | "tables" | "onChange">): ReactElement | null {
  const patch = (config: Record<string, unknown>): void =>
    onChange({ ...field, config: { ...field.config, ...config } } as FieldDefinition);

  switch (field.type) {
    case "text":
      return (
        <>
          <Row label="Maximum length" hint="Leave empty for no limit.">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={10000}
                className="tbl-input"
                value={field.config.maxLength ?? ""}
                onChange={(e) => patch({ maxLength: nullableNumber(e.target.value) })}
              />
            )}
          </Row>
          <label>
            <input
              type="checkbox"
              checked={field.config.multiline}
              onChange={(e) => patch({ multiline: e.target.checked })}
            />{" "}
            Allow multiple lines
          </label>
        </>
      );
    case "long-text":
      return (
        <Row label="Format">
          {(id) => (
            <select
              id={id}
              className="tbl-input"
              value={field.config.format}
              onChange={(e) => patch({ format: e.target.value })}
            >
              <option value="plain">Plain text</option>
              <option value="markdown">Markdown</option>
              <option value="rich-text">Rich text</option>
            </select>
          )}
        </Row>
      );
    case "number":
      return (
        <>
          {(["precision", "scale", "minimum", "maximum"] as const).map((key) => (
            <Row
              key={key}
              label={key[0]?.toUpperCase() + key.slice(1)}
              hint="Leave empty for no limit."
            >
              {(id) => (
                <input
                  id={id}
                  type="number"
                  className="tbl-input"
                  value={field.config[key] ?? ""}
                  onChange={(e) => patch({ [key]: nullableNumber(e.target.value) })}
                />
              )}
            </Row>
          ))}
        </>
      );
    case "currency":
      return (
        <>
          <Row label="Currency code" hint="Three-letter ISO 4217 code, e.g. USD.">
            {(id) => (
              <input
                id={id}
                className="tbl-input"
                maxLength={3}
                value={field.config.currencyCode}
                onChange={(e) => patch({ currencyCode: e.target.value.toUpperCase() })}
              />
            )}
          </Row>
          <Row label="Decimal places">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                max={8}
                className="tbl-input"
                value={field.config.scale}
                onChange={(e) => patch({ scale: nullableNumber(e.target.value) ?? 0 })}
              />
            )}
          </Row>
        </>
      );
    case "percent":
      return (
        <>
          <Row label="Decimal places">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                max={8}
                className="tbl-input"
                value={field.config.scale}
                onChange={(e) => patch({ scale: nullableNumber(e.target.value) ?? 0 })}
              />
            )}
          </Row>
          <Row label="Stored as">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.storage}
                onChange={(e) => patch({ storage: e.target.value })}
              >
                <option value="whole-number">Whole number (50 = 50%)</option>
                <option value="fraction">Fraction (0.5 = 50%)</option>
              </select>
            )}
          </Row>
        </>
      );
    case "date":
      return (
        <>
          <Row label="Earliest date">
            {(id) => (
              <input
                id={id}
                type="date"
                className="tbl-input"
                value={field.config.minimum ?? ""}
                onChange={(e) => patch({ minimum: e.target.value || null })}
              />
            )}
          </Row>
          <Row label="Latest date">
            {(id) => (
              <input
                id={id}
                type="date"
                className="tbl-input"
                value={field.config.maximum ?? ""}
                onChange={(e) => patch({ maximum: e.target.value || null })}
              />
            )}
          </Row>
        </>
      );
    case "date-time":
      return (
        <Row
          label="Display time zone"
          hint="IANA name such as Australia/Sydney. Empty uses the viewer's zone."
        >
          {(id) => (
            <input
              id={id}
              className="tbl-input"
              value={field.config.displayTimeZone ?? ""}
              onChange={(e) => patch({ displayTimeZone: e.target.value || null })}
            />
          )}
        </Row>
      );
    case "duration":
      return (
        <>
          <Row label="Stored in">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.storageUnit}
                onChange={(e) => patch({ storageUnit: e.target.value })}
              >
                <option value="milliseconds">Milliseconds</option>
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            )}
          </Row>
          <Row label="Displayed in">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.displayUnit}
                onChange={(e) => patch({ displayUnit: e.target.value })}
              >
                <option value="automatic">Automatic</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            )}
          </Row>
        </>
      );
    case "boolean":
      return (
        <>
          <Row label="Label when true">
            {(id) => (
              <input
                id={id}
                className="tbl-input"
                value={field.config.trueLabel}
                onChange={(e) => patch({ trueLabel: e.target.value })}
              />
            )}
          </Row>
          <Row label="Label when false">
            {(id) => (
              <input
                id={id}
                className="tbl-input"
                value={field.config.falseLabel}
                onChange={(e) => patch({ falseLabel: e.target.value })}
              />
            )}
          </Row>
        </>
      );
    case "single-select":
      return (
        <OptionsEditor options={field.config.options} onChange={(options) => patch({ options })} />
      );
    case "multi-select":
      return (
        <>
          <OptionsEditor
            options={field.config.options}
            onChange={(options) => patch({ options })}
          />
          <Row label="Maximum selections" hint="Leave empty for no limit.">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                className="tbl-input"
                value={field.config.maximumSelections ?? ""}
                onChange={(e) => patch({ maximumSelections: nullableNumber(e.target.value) })}
              />
            )}
          </Row>
        </>
      );
    case "status": {
      const active = field.config.options.filter((o) => !o.archived);
      return (
        <>
          <OptionsEditor
            options={field.config.options}
            onChange={(options) => patch({ options })}
          />
          <Row label="Initial status">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.initialOptionId ?? ""}
                onChange={(e) => patch({ initialOptionId: e.target.value || null })}
              >
                <option value="">First option</option>
                {active.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label || "(unnamed)"}
                  </option>
                ))}
              </select>
            )}
          </Row>
          <fieldset>
            <legend>Closed statuses</legend>
            {active.map((o) => (
              <label key={o.id}>
                <input
                  type="checkbox"
                  checked={field.config.closedOptionIds.includes(o.id)}
                  onChange={(e) =>
                    patch({
                      closedOptionIds: e.target.checked
                        ? [...field.config.closedOptionIds, o.id]
                        : field.config.closedOptionIds.filter((id) => id !== o.id),
                    })
                  }
                />{" "}
                {o.label || "(unnamed)"}
              </label>
            ))}
          </fieldset>
        </>
      );
    }
    case "user":
    case "position":
      return (
        <p className="argus-muted">
          Any position may be chosen.{" "}
          {/* TODO(implementation): position picker once the directory port exists. */}
        </p>
      );
    case "link-to-record":
      return (
        <>
          <Row label="Link to table">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.targetTableId}
                onChange={(e) => patch({ targetTableId: e.target.value })}
              >
                <option value="">Choose a table…</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </Row>
          <label>
            <input
              type="checkbox"
              checked={field.config.allowMultiple}
              onChange={(e) => patch({ allowMultiple: e.target.checked })}
            />{" "}
            Allow linking several records (many-to-many; the engine manages the junction table)
          </label>
        </>
      );
    case "rollup":
    case "lookup": {
      const links = draftFields.filter(
        (f): f is Extract<FieldDefinition, { type: "link-to-record" }> =>
          f.type === "link-to-record",
      );
      const relation = links.find((l) => l.config.relationId === field.config.relationId);
      const target = tables.find((t) => t.id === relation?.config.targetTableId);
      return (
        <>
          <Row label="Through link field">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.relationId}
                onChange={(e) => patch({ relationId: e.target.value, targetFieldId: "" })}
              >
                <option value="">Choose a link field…</option>
                {links.map((l) => (
                  <option key={l.id} value={l.config.relationId}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          </Row>
          <Row label="Field on linked table">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.targetFieldId}
                disabled={!target}
                onChange={(e) => patch({ targetFieldId: e.target.value })}
              >
                <option value="">Choose a field…</option>
                {target?.fields.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </Row>
          {field.type === "rollup" ? (
            <Row label="Aggregation">
              {(id) => (
                <select
                  id={id}
                  className="tbl-input"
                  value={field.config.aggregation}
                  onChange={(e) => patch({ aggregation: e.target.value })}
                >
                  {["count", "sum", "average", "minimum", "maximum", "concatenate"].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              )}
            </Row>
          ) : null}
          {links.length === 0 ? <p role="status">Add a “Link to record” field first.</p> : null}
        </>
      );
    }
    case "formula":
      return (
        <>
          <Row
            label="Expression"
            hint="CEL expression over this table's field keys. Compiled to SQL where possible; the engine decides."
          >
            {(id, describedBy) => (
              <textarea
                id={id}
                aria-describedby={describedBy}
                className="tbl-input tbl-mono"
                rows={4}
                spellCheck={false}
                value={field.config.expression}
                onChange={(e) => patch({ expression: e.target.value })}
              />
            )}
          </Row>
          <Row label="Result type" hint="Empty lets the expression engine infer it.">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.resultType ?? ""}
                onChange={(e) => patch({ resultType: e.target.value || null })}
              >
                <option value="">Infer</option>
                {listFieldTypes()
                  .filter((p) => p.formula?.validResult)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.metadata.displayName}
                    </option>
                  ))}
              </select>
            )}
          </Row>
          <Row label="Execution">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.execution}
                onChange={(e) => patch({ execution: e.target.value })}
              >
                <option value="sql-view">SQL view column</option>
                <option value="sql-generated">SQL generated column</option>
                <option value="application">Evaluated in the app</option>
              </select>
            )}
          </Row>
        </>
      );
    case "attachment":
      return (
        <>
          <Row label="Maximum files" hint="Leave empty for no limit.">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                className="tbl-input"
                value={field.config.maximumFiles ?? ""}
                onChange={(e) => patch({ maximumFiles: nullableNumber(e.target.value) })}
              />
            )}
          </Row>
          <Row label="Maximum bytes per file">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                className="tbl-input"
                value={field.config.maximumBytesPerFile}
                onChange={(e) =>
                  patch({ maximumBytesPerFile: nullableNumber(e.target.value) ?? 1 })
                }
              />
            )}
          </Row>
          <Row
            label="Allowed MIME types"
            hint="Comma-separated, e.g. image/png, application/pdf. Empty allows none."
          >
            {(id) => (
              <input
                id={id}
                className="tbl-input"
                value={field.config.allowedMimeTypes.join(", ")}
                onChange={(e) =>
                  patch({
                    allowedMimeTypes: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
          </Row>
        </>
      );
    case "location":
      return (
        <Row label="Geometry" hint="Stored as PostGIS in SRID 4326 with a spatial index.">
          {(id) => (
            <select
              id={id}
              className="tbl-input"
              value={field.config.geometry}
              onChange={(e) => patch({ geometry: e.target.value })}
            >
              <option value="point">Point</option>
              <option value="linestring">Line</option>
              <option value="polygon">Polygon</option>
              <option value="geometry">Any geometry</option>
            </select>
          )}
        </Row>
      );
    case "phone":
      return (
        <Row label="Default region" hint="Two-letter country code, e.g. AU.">
          {(id) => (
            <input
              id={id}
              className="tbl-input"
              maxLength={2}
              value={field.config.defaultRegion ?? ""}
              onChange={(e) => patch({ defaultRegion: e.target.value.toUpperCase() || null })}
            />
          )}
        </Row>
      );
    case "email":
      return (
        <Row label="Allowed domains" hint="Comma-separated. Empty allows any domain.">
          {(id) => (
            <input
              id={id}
              className="tbl-input"
              value={field.config.allowedDomains.join(", ")}
              onChange={(e) =>
                patch({
                  allowedDomains: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
        </Row>
      );
    case "url":
      return (
        <fieldset>
          <legend>Allowed protocols</legend>
          {(["https", "http"] as const).map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                checked={field.config.allowedProtocols.includes(p)}
                onChange={(e) =>
                  patch({
                    allowedProtocols: e.target.checked
                      ? [...field.config.allowedProtocols, p]
                      : field.config.allowedProtocols.filter((x) => x !== p),
                  })
                }
              />{" "}
              {p}
            </label>
          ))}
        </fieldset>
      );
    case "auto-number":
      return (
        <>
          <Row label="Prefix" hint="For example SE- produces SE-0042.">
            {(id) => (
              <input
                id={id}
                className="tbl-input"
                maxLength={30}
                value={field.config.prefix}
                onChange={(e) => patch({ prefix: e.target.value })}
              />
            )}
          </Row>
          <Row label="Digits">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={12}
                className="tbl-input"
                value={field.config.padding}
                onChange={(e) => patch({ padding: nullableNumber(e.target.value) ?? 1 })}
              />
            )}
          </Row>
          <Row label="Numbering restarts per">
            {(id) => (
              <select
                id={id}
                className="tbl-input"
                value={field.config.scope}
                onChange={(e) => patch({ scope: e.target.value })}
              >
                <option value="incident">Incident</option>
                <option value="tenant">Tenant (never restarts)</option>
              </select>
            )}
          </Row>
        </>
      );
    case "signature":
      return (
        <>
          <Row
            label="What a signature means"
            hint="Shown to the signer and recorded in the audit log."
          >
            {(id) => (
              <input
                id={id}
                className="tbl-input"
                value={field.config.meaning}
                onChange={(e) => patch({ meaning: e.target.value })}
              />
            )}
          </Row>
          <label>
            <input
              type="checkbox"
              checked={field.config.requireReauthentication}
              onChange={(e) => patch({ requireReauthentication: e.target.checked })}
            />{" "}
            Require re-authentication to sign
          </label>
        </>
      );
    case "json":
      return (
        <p className="argus-muted">
          Free-form JSON.{" "}
          {/* TODO(implementation): JSON Schema editor for the optional validation schema. */}
        </p>
      );
  }
}

/**
 * Add/edit form for one field. The type list comes from the @argus/field-types plugin list, so a new
 * field type module appears here without UI changes (a config form is still needed for its options).
 * Output: controlled edits of a FieldDefinition draft; nothing is persisted from this component.
 */
export function FieldEditor({
  field,
  isNew,
  draftFields,
  tables,
  issues,
  onChange,
}: FieldEditorProps): ReactElement {
  const plugin = getFieldType(field.type);
  const patch = (next: Partial<FieldDefinition>): void =>
    onChange({ ...field, ...next } as FieldDefinition);

  return (
    <div className="argus-stack">
      {issues.length > 0 ? (
        <ul role="alert" className="tbl-issues">
          {issues.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <Row label="Field name">
        {(id) => (
          <input
            id={id}
            className="tbl-input"
            value={field.name}
            maxLength={200}
            onChange={(e) =>
              patch({
                name: e.target.value,
                ...(isNew && slugifyKey(field.name) === field.key
                  ? { key: slugifyKey(e.target.value) }
                  : {}),
              })
            }
          />
        )}
      </Row>
      <Row
        label="Key"
        hint={
          isNew
            ? "Stable identifier used in formulas and APIs. Renaming the field later never changes it."
            : "Published keys are immutable so formulas, views and integrations keep working."
        }
      >
        {(id, describedBy) => (
          <input
            id={id}
            aria-describedby={describedBy}
            className="tbl-input tbl-mono"
            value={field.key}
            readOnly={!isNew}
            onChange={(e) => patch({ key: e.target.value })}
          />
        )}
      </Row>
      <Row label="Type" hint={plugin?.metadata.description}>
        {(id, describedBy) => (
          <select
            id={id}
            aria-describedby={describedBy}
            className="tbl-input"
            value={field.type}
            onChange={(e) => onChange(withFieldType(field, e.target.value as FieldTypeId))}
          >
            {listFieldTypes().map((p) => (
              <option key={p.id} value={p.id}>
                {p.metadata.displayName}
                {p.metadata.release === "later" ? " (later release)" : ""}
              </option>
            ))}
          </select>
        )}
      </Row>
      {!isNew ? (
        <p role="note" className="argus-muted">
          Changing the type of a published field plans a conversion. Rows that cannot convert are
          listed in the schema change preview before anything is applied.
        </p>
      ) : null}
      {plugin?.metadata.release === "later" ? (
        <p role="note" className="argus-muted">
          This type's runtime behaviour ships in a later release; its configuration is already
          versioned.{" "}
          {/* TODO(verify): confirm release gating for later field types with product. */}
        </p>
      ) : null}

      <Row label="Description">
        {(id) => (
          <textarea
            id={id}
            className="tbl-input"
            rows={2}
            maxLength={2000}
            value={field.description ?? ""}
            onChange={(e) => patch({ description: e.target.value || null })}
          />
        )}
      </Row>

      <fieldset className="argus-stack">
        <legend>Type settings</legend>
        <ConfigForm field={field} draftFields={draftFields} tables={tables} onChange={onChange} />
      </fieldset>

      <fieldset className="argus-stack">
        <legend>Rules and access</legend>
        <label>
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => patch({ required: e.target.checked })}
          />{" "}
          Required
        </label>
        <label>
          <input
            type="checkbox"
            checked={field.unique}
            onChange={(e) => patch({ unique: e.target.checked })}
          />{" "}
          Unique
        </label>
        <label>
          <input
            type="checkbox"
            checked={field.indexed}
            onChange={(e) => patch({ indexed: e.target.checked })}
          />{" "}
          Indexed
        </label>
        <Row label="Sensitivity">
          {(id) => (
            <select
              id={id}
              className="tbl-input"
              value={field.sensitivity}
              onChange={(e) =>
                patch({ sensitivity: e.target.value as FieldDefinition["sensitivity"] })
              }
            >
              <option value="standard">Standard</option>
              <option value="personal">Personal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted</option>
            </select>
          )}
        </Row>
        <Row
          label="Default access"
          hint="Per-position overrides are managed under Administration. Hidden fields are removed from API payloads and live events."
        >
          {(id, describedBy) => (
            <select
              id={id}
              aria-describedby={describedBy}
              className="tbl-input"
              value={field.access.defaultMode}
              onChange={(e) =>
                patch({
                  access: {
                    ...field.access,
                    defaultMode: e.target.value as FieldDefinition["access"]["defaultMode"],
                  },
                })
              }
            >
              <option value="editable">Editable</option>
              <option value="read">Read-only</option>
              <option value="hidden">Hidden</option>
            </select>
          )}
        </Row>
      </fieldset>
    </div>
  );
}
