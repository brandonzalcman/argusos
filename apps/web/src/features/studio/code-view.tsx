import {
  CodeEditor,
  formatJson,
  issuesToDiagnostics,
  parseJsonSafe,
  zodIssuesToDefinitionIssues,
} from "@argus/code-editor";
import type { DefinitionIssue } from "@argus/schema";
import { Badge, Button } from "@argus/ui";
import { CircleAlert, CircleCheck, Lock, RotateCcw } from "@argus/ui/icons";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";

/** Minimal structural type for a Zod schema (avoids a hard zod type dependency here). */
export interface ParseableSchema<T> {
  readonly safeParse: (value: unknown) =>
    | { readonly success: true; readonly data: T }
    | {
        readonly success: false;
        readonly error: { readonly issues: { path: PropertyKey[]; message: string }[] };
      };
}

export type CodeValidation<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly DefinitionIssue[] }
  | { readonly ok: false; readonly issues: readonly DefinitionIssue[] };

/**
 * Parses and validates definition JSON text. Pure: used by the code view and by tests.
 * `extraValidate` adds semantic issues (references, permissions) on top of the schema.
 */
export function validateDefinitionText<T>(
  text: string,
  schema: ParseableSchema<T>,
  extraValidate?: (value: T) => readonly DefinitionIssue[],
): CodeValidation<T> {
  const parsed = parseJsonSafe(text);
  if (!parsed.ok) {
    return {
      ok: false,
      issues: [{ path: [], message: `Invalid JSON: ${parsed.message}`, severity: "error" }],
    };
  }
  const result = schema.safeParse(parsed.value);
  if (!result.success) {
    return { ok: false, issues: zodIssuesToDefinitionIssues(result.error) };
  }
  const extra = extraValidate ? extraValidate(result.data) : [];
  const blocking = extra.some((issue) => issue.severity === "error");
  return blocking ? { ok: false, issues: extra } : { ok: true, value: result.data, issues: extra };
}

export interface DefinitionCodeViewProps<T> {
  /** The current (draft) definition value. */
  readonly value: T;
  readonly schema: ParseableSchema<T>;
  /** Applies a valid edit to the draft (callers record it as one undo step). */
  readonly onApply: (value: T) => void;
  /** Accessible name, e.g. "Board definition code". */
  readonly label: string;
  /** False when the position lacks `editCode`: the code is shown read-only. */
  readonly editable: boolean;
  /** Semantic checks beyond the schema (e.g. layout items reference existing blocks). */
  readonly extraValidate?: (value: T) => readonly DefinitionIssue[];
  /** Apply automatically while typing when the text is valid (default: explicit Apply). */
  readonly applyOnValid?: boolean;
  readonly minHeight?: string;
  readonly maxHeight?: string;
}

/**
 * Two-way JSON code view for any studio definition (board bundle, page, block, component props).
 * Invalid text never reaches the draft: problems show as inline diagnostics and a summary, and
 * Apply stays disabled until the text parses and validates. External changes to `value` reset
 * the text only when the user has no unapplied edits.
 */
export function DefinitionCodeView<T>({
  value,
  schema,
  onApply,
  label,
  editable,
  extraValidate,
  applyOnValid = false,
  minHeight = "24rem",
  maxHeight = "70vh",
}: DefinitionCodeViewProps<T>): ReactElement {
  const canonical = useMemo(() => formatJson(value), [value]);
  const [text, setText] = useState(canonical);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setText(canonical);
  }, [canonical]);

  const validation = useMemo(
    () => validateDefinitionText(text, schema, extraValidate),
    [text, schema, extraValidate],
  );
  const diagnostics = useMemo(
    () => issuesToDiagnostics(text, validation.issues),
    [text, validation],
  );
  const dirty = text !== canonical;
  dirtyRef.current = dirty;

  const apply = (): void => {
    if (!validation.ok) return;
    onApply(validation.value);
    dirtyRef.current = false;
  };

  useEffect(() => {
    if (applyOnValid && dirty && validation.ok) {
      const timer = setTimeout(() => {
        onApply(validation.value);
        dirtyRef.current = false;
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [applyOnValid, dirty, validation, onApply]);

  const errors = validation.issues.filter((issue) => issue.severity === "error");
  const warnings = validation.issues.filter((issue) => issue.severity === "warning");

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!editable ? (
          <Badge tone="neutral" variant="outline" icon={<Lock />}>
            Read-only — your position can't edit code
          </Badge>
        ) : validation.ok ? (
          <Badge tone="success" icon={<CircleCheck />}>
            Valid{warnings.length > 0 ? ` · ${warnings.length} warning(s)` : ""}
          </Badge>
        ) : (
          <Badge tone="critical" icon={<CircleAlert />}>
            {errors.length} problem{errors.length === 1 ? "" : "s"}
          </Badge>
        )}
        {dirty && editable ? (
          <span className="text-sm text-fg-muted">Unapplied changes</span>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
          {editable && dirty ? (
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RotateCcw />}
              onClick={() => {
                dirtyRef.current = false;
                setText(canonical);
              }}
            >
              Discard
            </Button>
          ) : null}
          {editable && !applyOnValid ? (
            <Button size="sm" variant="primary" disabled={!dirty || !validation.ok} onClick={apply}>
              Apply to draft
            </Button>
          ) : null}
        </div>
      </div>
      <CodeEditor
        value={text}
        onChange={setText}
        language="json"
        diagnostics={diagnostics}
        readOnly={!editable}
        aria-label={label}
        minHeight={minHeight}
        maxHeight={maxHeight}
        {...(editable && !applyOnValid ? { onSave: () => apply() } : {})}
      />
      {errors.length > 0 && editable ? (
        <ul aria-label="Problems" className="grid gap-1 text-sm">
          {errors.slice(0, 8).map((issue, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: issues have no stable id
              key={index}
              className="flex gap-2 text-critical"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {issue.path.length > 0 ? (
                  <code className="me-1 font-mono text-fg-muted">{issue.path.join(".")}</code>
                ) : null}
                {issue.message}
              </span>
            </li>
          ))}
          {errors.length > 8 ? (
            <li className="text-fg-muted">…and {errors.length - 8} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
