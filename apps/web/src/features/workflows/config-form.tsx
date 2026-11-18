import { Field, Input, Select, Textarea } from "@argus/ui";
import type { ReactElement } from "react";
import type { FieldDescriptor } from "./config-fields.js";

export type ConfigValue = Readonly<Record<string, unknown>>;

export interface ConfigFormProps {
  /** Changing the key remounts inputs so uncontrolled text is re-initialised (e.g. step id). */
  readonly formKey: string;
  readonly fields: readonly FieldDescriptor[];
  readonly value: ConfigValue;
  /** Field-level errors keyed by field key, produced from the Zod schema. */
  readonly errors: Readonly<Record<string, string>>;
  readonly onChange: (key: string, value: unknown) => void;
  readonly readOnly?: boolean;
}

function displayValue(descriptor: FieldDescriptor, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (descriptor.kind === "id-list" && Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

function parseValue(descriptor: FieldDescriptor, text: string): unknown {
  switch (descriptor.kind) {
    case "number":
      return text.trim() === "" ? Number.NaN : Number(text);
    case "cel-nullable":
      return text.trim() === "" ? null : text;
    case "id-list":
      return text
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    default:
      return text;
  }
}

/**
 * Renders labelled design-system fields for a descriptor list with inline validation messages.
 * Input: descriptors, current value, errors. Output: accessible form fields (no submit).
 * Errors: none; invalid values are reported through `errors`, never silently coerced.
 */
export function ConfigForm({
  formKey,
  fields,
  value,
  errors,
  onChange,
  readOnly = false,
}: ConfigFormProps): ReactElement {
  return (
    <div className="grid gap-3">
      {fields.map((descriptor) => {
        const error = errors[descriptor.key];
        const initial = displayValue(descriptor, value[descriptor.key]);
        const controlKey = `${formKey}-${descriptor.key}`;
        let control: ReactElement;
        if (descriptor.kind === "select") {
          control = (
            <Select
              key={controlKey}
              disabled={readOnly}
              value={initial}
              onValueChange={(next) => onChange(descriptor.key, next)}
              options={(descriptor.options ?? []).map((option) => ({
                value: option,
                label: option,
              }))}
            />
          );
        } else if (
          descriptor.kind === "textarea" ||
          descriptor.kind === "cel" ||
          descriptor.kind === "cel-nullable"
        ) {
          control = (
            <Textarea
              rows={descriptor.kind === "textarea" ? 4 : 3}
              spellCheck={false}
              readOnly={readOnly}
              key={controlKey}
              defaultValue={initial}
              className={descriptor.kind === "textarea" ? undefined : "font-mono text-sm"}
              onChange={(event) =>
                onChange(descriptor.key, parseValue(descriptor, event.target.value))
              }
            />
          );
        } else {
          control = (
            <Input
              type={descriptor.kind === "number" ? "number" : "text"}
              readOnly={readOnly}
              key={controlKey}
              defaultValue={initial}
              spellCheck={false}
              onChange={(event) =>
                onChange(descriptor.key, parseValue(descriptor, event.target.value))
              }
            />
          );
        }
        return (
          <Field
            key={descriptor.key}
            label={descriptor.label}
            {...(descriptor.help ? { description: descriptor.help } : {})}
            {...(error ? { error } : {})}
          >
            {control}
          </Field>
        );
      })}
    </div>
  );
}

/** Maps Zod issues to first-error-per-top-level-key (nested paths use their joined path). */
export function issuesToErrors(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
