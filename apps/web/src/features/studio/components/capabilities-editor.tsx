import type { PluginCapability } from "@argus/schema";
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Textarea,
} from "@argus/ui";
import { Plus, ShieldAlert, Trash2, TriangleAlert } from "@argus/ui/icons";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import {
  addCapability,
  availableCapabilityTypes,
  type CapabilityListKey,
  capabilityInfo,
  formatList,
  getCapabilityList,
  listKeysFor,
  parseList,
  removeCapability,
  setCapabilityList,
  validateCapabilities,
} from "./capabilities-model.js";

const listLabels: Readonly<
  Record<CapabilityListKey, { label: string; description: string; placeholder: string }>
> = {
  tableIds: {
    label: "Table ids",
    description: "One per line or comma separated.",
    placeholder: "00000000-0000-4000-8000-000000000000",
  },
  fieldIds: {
    label: "Field ids",
    description: "Only these fields cross the bridge; hidden fields are always removed.",
    placeholder: "00000000-0000-4000-8000-000000000000",
  },
  allowedHosts: {
    label: "Allowed hosts",
    description: "Bare host names, for example api.example.org.",
    placeholder: "api.example.org",
  },
  actionKeys: {
    label: "Workflow action keys",
    description: "Keys of the workflow actions this component may start.",
    placeholder: "notify_duty_officer",
  },
};

export interface CapabilitiesEditorProps {
  readonly capabilities: readonly PluginCapability[];
  readonly onChange: (capabilities: PluginCapability[]) => void;
  readonly disabled: boolean;
}

/** Declares what the component's code may access. Publishers review this list before publish. */
export function CapabilitiesEditor({
  capabilities,
  onChange,
  disabled,
}: CapabilitiesEditorProps): ReactElement {
  const issues = useMemo(() => validateCapabilities(capabilities), [capabilities]);
  const available = availableCapabilityTypes(capabilities);
  return (
    <div className="grid gap-3">
      <div
        role="note"
        className="flex gap-3 rounded-md border border-warning bg-warning-subtle p-3 text-sm text-fg"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>
          <strong>Capabilities are what this component's code may access.</strong> Anything not
          listed is blocked by the sandbox. Whoever publishes must review this list: publishing
          grants these capabilities to every board and page that uses this version.
        </p>
      </div>
      {capabilities.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong p-3 text-sm text-fg-muted">
          No capabilities: the component can render its props but can't read or change any data.
        </p>
      ) : null}
      <ul className="grid gap-3" aria-label="Declared capabilities">
        {capabilities.map((capability, index) => {
          const info = capabilityInfo[capability.type];
          const own = issues.filter((i) => i.index === index);
          return (
            <li key={capability.type}>
              <Card className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-fg">{info.label}</h3>
                  {info.requiresAdminApproval ? (
                    <Badge tone="warning" icon={<ShieldAlert />}>
                      Requires administrator approval
                    </Badge>
                  ) : null}
                  {!info.enforcedBySandbox ? (
                    <Badge tone="neutral" variant="outline">
                      Not active in the sandbox yet
                    </Badge>
                  ) : null}
                  {!disabled ? (
                    <IconButton
                      className="ms-auto"
                      label={`Remove ${info.label}`}
                      icon={<Trash2 />}
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange(removeCapability(capabilities, index))}
                    />
                  ) : null}
                </div>
                <p className="text-sm text-fg-muted">{info.description}</p>
                {/* TODO(implementation): replace the id text areas with table/field pickers.
                    Input: tenant table catalog + field definitions. Output: ids.
                    Errors: picker shows "not connected". Depends on: tables catalog queries. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {listKeysFor(capability.type).map((key) => (
                    <ListField
                      key={key}
                      listKey={key}
                      items={getCapabilityList(capability, key)}
                      disabled={disabled}
                      onChange={(items) =>
                        onChange(setCapabilityList(capabilities, index, key, items))
                      }
                    />
                  ))}
                </div>
                {own.length > 0 ? (
                  <ul className="grid gap-1 text-sm">
                    {own.map((issue) => (
                      <li
                        key={issue.message}
                        className={issue.severity === "error" ? "text-critical" : "text-warning"}
                      >
                        {issue.severity === "error" ? "Error: " : "Note: "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
      {!disabled ? (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button leadingIcon={<Plus />} disabled={available.length === 0}>
                Add capability
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {available.map((type) => (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => onChange(addCapability(capabilities, type))}
                >
                  {capabilityInfo[type].label}
                  {capabilityInfo[type].requiresAdminApproval ? " (needs approval)" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

interface ListFieldProps {
  readonly listKey: CapabilityListKey;
  readonly items: readonly string[];
  readonly disabled: boolean;
  readonly onChange: (items: string[]) => void;
}

/** Text-list input that keeps its raw text while typing so separators aren't swallowed. */
function ListField({ listKey, items, disabled, onChange }: ListFieldProps): ReactElement {
  const meta = listLabels[listKey];
  const [text, setText] = useState(() => formatList(items));
  useEffect(() => {
    // External change (reload, definition tab): adopt it unless it equals what the text parses to.
    if (formatList(parseList(text)) !== formatList(items)) setText(formatList(items));
    // eslint-disable-next-line: text intentionally omitted; only external item changes resync.
  }, [items]);
  return (
    <Field label={meta.label} description={meta.description} disabled={disabled}>
      <Textarea
        rows={3}
        spellCheck={false}
        className="font-mono"
        placeholder={meta.placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseList(e.target.value));
        }}
      />
    </Field>
  );
}
