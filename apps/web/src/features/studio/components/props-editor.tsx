import type { ComponentProp, ComponentPropType } from "@argus/schema";
import { Button, Card, Field, IconButton, Input, Select, Switch, Textarea } from "@argus/ui";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@argus/ui/icons";
import { type ReactElement, useMemo } from "react";
import {
  addOption,
  addProp,
  MAX_COMPONENT_PROPS,
  moveProp,
  type PropIssue,
  parseNumberInput,
  propTypeOptions,
  removeOption,
  removeProp,
  updateOption,
  updateProp,
  validateProps,
} from "./props-model.js";

const NO_DEFAULT = "__none__";

function selectedValue(value: unknown, allowNone: boolean): { value?: string } {
  if (typeof value === "string" && value !== "") return { value };
  return allowNone ? { value: NO_DEFAULT } : {};
}

export interface PropsEditorProps {
  readonly props: readonly ComponentProp[];
  readonly onChange: (props: ComponentProp[]) => void;
  readonly disabled: boolean;
}

function issueFor(
  issues: readonly PropIssue[],
  index: number,
  field: PropIssue["field"],
): string | undefined {
  return issues.find((i) => i.index === index && i.field === field)?.message;
}

/** No-code editor for the component's declared props. */
export function PropsEditor({ props, onChange, disabled }: PropsEditorProps): ReactElement {
  const issues = useMemo(() => validateProps(props), [props]);
  return (
    <div className="grid gap-3">
      <p className="text-sm text-fg-muted">
        Props are the inputs people set when they place this component on a board or page. The code
        reads them with <code className="font-mono">useProps()</code>.
      </p>
      {props.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong p-3 text-sm text-fg-muted">
          No props declared. Add one to let people configure this component.
        </p>
      ) : null}
      <ol className="grid gap-3" aria-label="Declared props">
        {props.map((prop, index) => (
          <li key={index}>
            <PropCard
              prop={prop}
              index={index}
              count={props.length}
              issues={issues}
              disabled={disabled}
              onChange={onChange}
              all={props}
            />
          </li>
        ))}
      </ol>
      {!disabled ? (
        <div>
          <Button
            leadingIcon={<Plus />}
            disabled={props.length >= MAX_COMPONENT_PROPS}
            onClick={() => onChange(addProp(props))}
          >
            Add prop
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface PropCardProps {
  readonly prop: ComponentProp;
  readonly index: number;
  readonly count: number;
  readonly issues: readonly PropIssue[];
  readonly disabled: boolean;
  readonly all: readonly ComponentProp[];
  readonly onChange: (props: ComponentProp[]) => void;
}

function PropCard({
  prop,
  index,
  count,
  issues,
  disabled,
  all,
  onChange,
}: PropCardProps): ReactElement {
  const patch = (next: Partial<ComponentProp>): void => onChange(updateProp(all, index, next));
  const optionsError = issueFor(issues, index, "options");
  return (
    <Card className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-fg">
          <span className="text-fg-muted">#{index + 1}</span>{" "}
          <code className="font-mono">{prop.key || "(no key)"}</code>
        </h3>
        {!disabled ? (
          <div className="ms-auto flex items-center gap-1">
            <IconButton
              label={`Move ${prop.key} up`}
              icon={<ArrowUp />}
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => onChange(moveProp(all, index, -1))}
            />
            <IconButton
              label={`Move ${prop.key} down`}
              icon={<ArrowDown />}
              variant="ghost"
              size="sm"
              disabled={index === count - 1}
              onClick={() => onChange(moveProp(all, index, 1))}
            />
            <IconButton
              label={`Remove ${prop.key}`}
              icon={<Trash2 />}
              variant="ghost"
              size="sm"
              onClick={() => onChange(removeProp(all, index))}
            />
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Key"
          description="Used in code: props.key"
          error={issueFor(issues, index, "key")}
          disabled={disabled}
          required
        >
          <Input mono value={prop.key} onChange={(e) => patch({ key: e.target.value })} />
        </Field>
        <Field label="Label" error={issueFor(issues, index, "label")} disabled={disabled} required>
          <Input value={prop.label} onChange={(e) => patch({ label: e.target.value })} />
        </Field>
        <Field label="Type" disabled={disabled}>
          <Select
            options={propTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
            value={prop.type}
            onValueChange={(value) => patch({ type: value as ComponentPropType })}
          />
        </Field>
        <div className="flex items-end pb-1">
          <Switch
            label="Required"
            checked={prop.required}
            disabled={disabled}
            onCheckedChange={(required) => patch({ required })}
          />
        </div>
        <Field
          label="Default value"
          description="Used when nothing is set at placement."
          error={issueFor(issues, index, "defaultValue")}
          disabled={disabled}
        >
          <DefaultValueInput
            prop={prop}
            disabled={disabled}
            onChange={(v) => patch({ defaultValue: v })}
          />
        </Field>
        <Field label="Description" disabled={disabled}>
          <Input
            value={prop.description ?? ""}
            onChange={(e) => patch({ description: e.target.value === "" ? null : e.target.value })}
          />
        </Field>
      </div>
      {prop.type === "enum" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-fg">Choices</legend>
          {optionsError ? <p className="text-sm text-critical">{optionsError}</p> : null}
          {prop.options.map((option, optionIndex) => (
            <div key={optionIndex} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Field label="Value" disabled={disabled}>
                <Input
                  mono
                  value={option.value}
                  onChange={(e) =>
                    onChange(updateOption(all, index, optionIndex, { value: e.target.value }))
                  }
                />
              </Field>
              <Field label="Label" disabled={disabled}>
                <Input
                  value={option.label}
                  onChange={(e) =>
                    onChange(updateOption(all, index, optionIndex, { label: e.target.value }))
                  }
                />
              </Field>
              {!disabled ? (
                <IconButton
                  label={`Remove choice ${option.label || option.value}`}
                  icon={<Trash2 />}
                  variant="ghost"
                  onClick={() => onChange(removeOption(all, index, optionIndex))}
                />
              ) : null}
            </div>
          ))}
          {!disabled ? (
            <div>
              <Button
                size="sm"
                leadingIcon={<Plus />}
                onClick={() => onChange(addOption(all, index))}
              >
                Add choice
              </Button>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </Card>
  );
}

interface ValueInputProps {
  readonly prop: ComponentProp;
  readonly disabled: boolean;
  readonly onChange: (value: ComponentProp["defaultValue"]) => void;
}

function DefaultValueInput({ prop, disabled, onChange }: ValueInputProps): ReactElement {
  return (
    <TypedValueInput
      prop={prop}
      value={prop.defaultValue}
      disabled={disabled}
      onChange={onChange}
      allowNone
    />
  );
}

interface TypedValueInputProps {
  readonly prop: ComponentProp;
  readonly value: unknown;
  readonly disabled: boolean;
  readonly allowNone?: boolean;
  readonly onChange: (value: ComponentProp["defaultValue"]) => void;
}

/** One control for a prop value, chosen by prop type. Shared by defaults and preview values. */
function TypedValueInput({
  prop,
  value,
  disabled,
  allowNone = false,
  onChange,
}: TypedValueInputProps): ReactElement {
  switch (prop.type) {
    case "boolean":
      return (
        <Switch
          aria-label={`${prop.label} value`}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={typeof value === "number" ? String(value) : ""}
          disabled={disabled}
          onChange={(e) => onChange(parseNumberInput(e.target.value))}
        />
      );
    case "enum":
      return (
        <Select
          options={[
            ...(allowNone ? [{ value: NO_DEFAULT, label: "No default" }] : []),
            ...prop.options
              .filter((o) => o.value !== "")
              .map((o) => ({ value: o.value, label: o.label || o.value })),
          ]}
          {...selectedValue(value, allowNone)}
          placeholder="Choose a value"
          disabled={disabled}
          onValueChange={(v) => onChange(v === NO_DEFAULT ? null : v)}
        />
      );
    case "text":
    case "cel":
      return (
        <Textarea
          rows={2}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );
    case "color":
      return (
        <Input
          placeholder="#0a5cff or a token"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );
    case "table":
    case "field":
    case "board":
    case "page":
      // TODO(implementation): replace the text id with a table/field/board/page picker.
      // Input: tenant catalog. Output: the chosen id. Errors: picker shows "not connected".
      // Depends on: table/board/page catalog queries and field-level security.
      return (
        <Input
          mono
          placeholder="Id (picker coming soon)"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );
    default:
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );
  }
}

export interface PreviewValuesFormProps {
  readonly props: readonly ComponentProp[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly onChange: (values: Record<string, unknown>) => void;
}

/** Form generated from the props; its values feed the preview only and are never saved. */
export function PreviewValuesForm({
  props,
  values,
  onChange,
}: PreviewValuesFormProps): ReactElement {
  if (props.length === 0) {
    return <p className="text-sm text-fg-muted">Declare props to set values for the preview.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {props.map((prop) => (
        <Field
          key={`${prop.key}:${prop.type}`}
          label={prop.label || prop.key}
          description={prop.description ?? undefined}
          required={prop.required}
        >
          <TypedValueInput
            prop={prop}
            value={values[prop.key] ?? prop.defaultValue}
            disabled={false}
            onChange={(value) => {
              const next = { ...values };
              if (value === null) delete next[prop.key];
              else next[prop.key] = value;
              onChange(next);
            }}
          />
        </Field>
      ))}
    </div>
  );
}
