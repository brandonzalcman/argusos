import { type ReactElement, useEffect, useId, useState } from "react";
import {
  type ConditionGroup,
  type ConditionRow,
  type ConditionValueType,
  compileCondition,
  conditionOperators,
  type ExpressionValidationPort,
  MAX_EXPRESSION_LENGTH,
  parseCondition,
  visibilityBindingSources,
} from "./expression.js";

const emptyRow: ConditionRow = { path: "record.", operator: "==", valueType: "string", value: "" };
const emptyGroup: ConditionGroup = { joiner: "&&", rows: [emptyRow] };

type ValidationView =
  | { readonly kind: "none" }
  | { readonly kind: "checking" }
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly messages: readonly string[] }
  | { readonly kind: "unavailable" };

/** Debounced validation through the injected expression port; never reports "valid" without it. */
function useExpressionValidation(
  text: string | null,
  definitionId: string,
  revision: number,
  port: ExpressionValidationPort,
): ValidationView {
  const [view, setView] = useState<ValidationView>({ kind: "none" });
  useEffect(() => {
    if (text === null || text.trim() === "") {
      setView({ kind: "none" });
      return;
    }
    let cancelled = false;
    setView({ kind: "checking" });
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await port.validate({ definitionId, revision, text, use: "visibility" });
          if (cancelled) return;
          setView(
            result.status === "valid"
              ? { kind: "valid" }
              : { kind: "invalid", messages: result.diagnostics.map((d) => d.message) },
          );
        } catch {
          if (!cancelled) setView({ kind: "unavailable" });
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, definitionId, revision, port]);
  return view;
}

export interface ConditionEditorProps {
  readonly label: string;
  /** Current CEL source, or null for "always visible". */
  readonly value: string | null;
  readonly onChange: (next: string | null) => void;
  readonly validator: ExpressionValidationPort;
  readonly definitionId: string;
  readonly revision: number;
}

/**
 * Point-and-click condition editor that writes CEL, with a raw CEL editor for power users.
 * Input: current CEL string and a validator port mirroring @argus/expr parse/type-check.
 * Output: calls `onChange` with a safely compiled CEL string (values escaped) or null to clear.
 * Errors: invalid rows are reported inline and never emitted; validator failures show as "not validated".
 * Depends on: ExpressionValidationPort (TODO(implementation): @argus/expr adapter).
 */
export function ConditionEditor({
  label,
  value,
  onChange,
  validator,
  definitionId,
  revision,
}: ConditionEditorProps): ReactElement {
  const parsed = value === null ? null : parseCondition(value);
  const representable = value === null || parsed !== null;
  const [mode, setMode] = useState<"builder" | "cel">(representable ? "builder" : "cel");
  const [group, setGroup] = useState<ConditionGroup>(parsed ?? emptyGroup);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const baseId = useId();

  // Re-sync when the value changes from outside (undo/redo, selecting another block).
  useEffect(() => {
    const compiled = compileCondition(group);
    const current = compiled.ok ? compiled.source : null;
    if (value !== current) {
      const next = value === null ? null : parseCondition(value);
      setGroup(next ?? emptyGroup);
      setErrors([]);
      if (value !== null && next === null) setMode("cel");
    }
  }, [value]);

  const validation = useExpressionValidation(value, definitionId, revision, validator);

  const updateGroup = (next: ConditionGroup): void => {
    setGroup(next);
    const compiled = compileCondition(next);
    if (compiled.ok) {
      setErrors([]);
      onChange(compiled.source);
    } else {
      setErrors(compiled.errors);
    }
  };
  const updateRow = (index: number, patch: Partial<ConditionRow>): void =>
    updateGroup({
      ...group,
      rows: group.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });

  return (
    <fieldset className="boards-fieldset">
      <legend>{label}</legend>
      <fieldset className="boards-toolbar boards-plain-fieldset">
        <legend className="boards-visually-hidden">Editor mode</legend>
        <button
          type="button"
          aria-pressed={mode === "builder"}
          className="boards-btn"
          disabled={!representable}
          onClick={() => setMode("builder")}
        >
          Conditions
        </button>
        <button
          type="button"
          aria-pressed={mode === "cel"}
          className="boards-btn"
          onClick={() => setMode("cel")}
        >
          CEL
        </button>
        <button
          type="button"
          className="boards-btn"
          disabled={value === null}
          onClick={() => {
            setGroup(emptyGroup);
            setErrors([]);
            onChange(null);
          }}
        >
          Clear
        </button>
      </fieldset>
      {!representable ? (
        <p className="boards-help">
          This expression uses CEL beyond the point-and-click editor; edit it as CEL.
        </p>
      ) : null}

      {mode === "builder" ? (
        <div>
          {group.rows.length > 1 ? (
            <div className="boards-field">
              <label htmlFor={`${baseId}-joiner`}>Match</label>
              <select
                id={`${baseId}-joiner`}
                className="boards-select"
                value={group.joiner}
                onChange={(event) =>
                  updateGroup({ ...group, joiner: event.target.value === "||" ? "||" : "&&" })
                }
              >
                <option value="&&">All conditions (AND)</option>
                <option value="||">Any condition (OR)</option>
              </select>
            </div>
          ) : null}
          {group.rows.map((row, index) => {
            const rowId = `${baseId}-row-${index}`;
            return (
              <fieldset key={rowId} className="boards-row boards-plain-fieldset">
                <legend className="boards-visually-hidden">Condition {index + 1}</legend>
                <input
                  className="boards-input"
                  aria-label="Field"
                  list={`${baseId}-bindings`}
                  value={row.path}
                  onChange={(event) => updateRow(index, { path: event.target.value })}
                />
                <select
                  className="boards-select"
                  aria-label="Operator"
                  value={row.operator}
                  onChange={(event) =>
                    updateRow(index, {
                      operator: conditionOperators.find((op) => op === event.target.value) ?? "==",
                    })
                  }
                >
                  {conditionOperators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <select
                  className="boards-select"
                  aria-label="Value type"
                  value={row.valueType}
                  onChange={(event) =>
                    updateRow(index, {
                      valueType: event.target.value as ConditionValueType,
                      value: event.target.value === "boolean" ? "true" : "",
                    })
                  }
                >
                  <option value="string">text</option>
                  <option value="number">number</option>
                  <option value="boolean">true/false</option>
                  <option value="null">null</option>
                </select>
                {row.valueType === "boolean" ? (
                  <select
                    className="boards-select"
                    aria-label="Value"
                    value={row.value}
                    onChange={(event) => updateRow(index, { value: event.target.value })}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : row.valueType === "null" ? null : (
                  <input
                    className="boards-input"
                    aria-label="Value"
                    value={row.value}
                    onChange={(event) => updateRow(index, { value: event.target.value })}
                  />
                )}
                <button
                  type="button"
                  className="boards-btn"
                  aria-label={`Remove condition ${index + 1}`}
                  disabled={group.rows.length === 1}
                  onClick={() =>
                    updateGroup({ ...group, rows: group.rows.filter((_, i) => i !== index) })
                  }
                >
                  Remove
                </button>
              </fieldset>
            );
          })}
          <datalist id={`${baseId}-bindings`}>
            {visibilityBindingSources.map((source) => (
              <option key={source} value={`${source}.`} />
            ))}
          </datalist>
          <button
            type="button"
            className="boards-btn"
            onClick={() => setGroup({ ...group, rows: [...group.rows, emptyRow] })}
          >
            Add condition
          </button>
        </div>
      ) : (
        <div className="boards-field">
          <label htmlFor={`${baseId}-cel`}>CEL expression</label>
          <textarea
            id={`${baseId}-cel`}
            className="boards-textarea"
            spellCheck={false}
            maxLength={MAX_EXPRESSION_LENGTH}
            value={value ?? ""}
            aria-describedby={`${baseId}-status`}
            onChange={(event) => {
              const text = event.target.value;
              onChange(text.trim() === "" ? null : text);
            }}
          />
          <p className="boards-help">
            Example: <code>record.priority == "Critical"</code>. Allowed bindings:{" "}
            {visibilityBindingSources.join(", ")}.
          </p>
        </div>
      )}

      {errors.map((message) => (
        <p key={message} className="boards-field-error" role="alert">
          {message}
        </p>
      ))}
      <p id={`${baseId}-status`} className="boards-help" role="status" aria-live="polite">
        {validation.kind === "none" ? "Always visible (no condition)." : null}
        {validation.kind === "checking" ? "Checking…" : null}
        {validation.kind === "valid" ? "Valid expression." : null}
        {validation.kind === "invalid" ? `Invalid: ${validation.messages.join("; ")}` : null}
        {validation.kind === "unavailable"
          ? "Not validated — the expression validator is not connected yet (TODO(implementation)). Server-side validation is still required before publish."
          : null}
      </p>
      <p className="boards-help">
        Visibility is a presentation rule only; it never replaces server-side authorization.
      </p>
    </fieldset>
  );
}
