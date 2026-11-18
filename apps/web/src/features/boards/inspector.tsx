import { Tabs, TabsContent, TabsList, TabsTrigger } from "@argus/ui";
import { type ReactElement, useId, useState } from "react";
import { ejectBlockToComponent } from "./code-mode.js";
import { BlockCodeView } from "./code-panes.js";
import { ConditionEditor } from "./condition-editor.js";
import { blockConfigFields, type ConfigField, validateConfig } from "./config-schema.js";
import {
  moveBlockTo,
  nudgeBlock,
  removeBlock,
  setBlockHidden,
  updateBlock,
  updateBlockConfig,
} from "./draft.js";
import type { ExpressionValidationPort } from "./expression.js";
import { GRID_COLUMNS } from "./layout-ops.js";
import type {
  BlockConfig,
  BlockDefinition,
  BlockKind,
  BoardBundle,
  LayoutBreakpoint,
  LayoutItem,
} from "./model.js";

export type EditHandler = (
  next: BoardBundle,
  options?: { key?: string; announce?: string },
) => void;

type AnyField = ConfigField<BlockKind>;

function JsonField({
  field,
  value,
  onCommit,
  id,
}: {
  readonly field: AnyField;
  readonly value: BlockConfig[string] | undefined;
  readonly onCommit: (value: BlockConfig[string]) => void;
  readonly id: string;
}): ReactElement {
  const [text, setText] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <textarea
        id={id}
        className="boards-textarea"
        spellCheck={false}
        value={text}
        aria-invalid={error !== null}
        onChange={(event) => {
          setText(event.target.value);
          try {
            onCommit(JSON.parse(event.target.value) as BlockConfig[string]);
            setError(null);
          } catch {
            setError("Not valid JSON; the previous value is kept.");
          }
        }}
      />
      {error ? (
        <p className="boards-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <span className="boards-visually-hidden">{field.label}</span>
    </>
  );
}

function ConfigControl({
  field,
  block,
  onEdit,
  bundle,
}: {
  readonly field: AnyField;
  readonly block: BlockDefinition;
  readonly bundle: BoardBundle;
  readonly onEdit: EditHandler;
}): ReactElement {
  const id = useId();
  const value = block.config[field.key];
  const set = (next: BlockConfig[string] | undefined): void =>
    onEdit(updateBlockConfig(bundle, block.id, field.key, next), {
      key: `cfg:${block.id}:${field.key}`,
    });
  switch (field.input) {
    case "boolean":
      return (
        <div className="boards-field">
          <label>
            <input
              type="checkbox"
              checked={value === true}
              onChange={(event) => set(event.target.checked)}
            />{" "}
            {field.label}
          </label>
        </div>
      );
    case "select":
      return (
        <div className="boards-field">
          <label htmlFor={id}>{field.label}</label>
          <select
            id={id}
            className="boards-select"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => set(event.target.value)}
          >
            <option value="" disabled>
              Choose…
            </option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "number":
      return (
        <div className="boards-field">
          <label htmlFor={id}>{field.label}</label>
          <input
            id={id}
            type="number"
            className="boards-input"
            min={field.min}
            max={field.max}
            value={typeof value === "number" ? value : ""}
            onChange={(event) =>
              set(event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
          {field.help ? <p className="boards-help">{field.help}</p> : null}
        </div>
      );
    case "textarea":
      return (
        <div className="boards-field">
          <label htmlFor={id}>{field.label}</label>
          <textarea
            id={id}
            className="boards-textarea"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => set(event.target.value)}
          />
          {field.help ? <p className="boards-help">{field.help}</p> : null}
        </div>
      );
    case "text-list":
      return (
        <div className="boards-field">
          <label htmlFor={id}>{field.label} (one per line)</label>
          <textarea
            id={id}
            className="boards-textarea"
            value={Array.isArray(value) ? value.join("\n") : ""}
            onChange={(event) =>
              set(
                event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter((line) => line !== ""),
              )
            }
          />
        </div>
      );
    case "json":
      return (
        <div className="boards-field">
          <label htmlFor={id}>{field.label}</label>
          <JsonField field={field} id={id} value={value} onCommit={(next) => set(next)} />
          {field.help ? <p className="boards-help">{field.help}</p> : null}
        </div>
      );
    case "text":
      return (
        <div className="boards-field">
          <label htmlFor={id}>
            {field.label}
            {field.required ? " *" : ""}
          </label>
          <input
            id={id}
            className="boards-input"
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => set(event.target.value)}
          />
          {field.help ? <p className="boards-help">{field.help}</p> : null}
        </div>
      );
  }
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
}): ReactElement {
  const id = useId();
  return (
    <div className="boards-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        className="boards-input"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          if (event.target.value !== "") onChange(Number(event.target.value));
        }}
      />
    </div>
  );
}

export interface InspectorProps {
  readonly bundle: BoardBundle;
  readonly block: BlockDefinition | undefined;
  readonly item: LayoutItem | undefined;
  readonly breakpoint: LayoutBreakpoint;
  readonly validator: ExpressionValidationPort;
  readonly onEdit: EditHandler;
  readonly displayName: string;
  /**
   * Dev mode code tab. When set, a selected block gets "Settings | Code" tabs; `editable` is false
   * for positions without `editCode` (the code is then shown read-only). Applying replaces the
   * block as one undo step through `onEdit`.
   */
  readonly code?: { readonly editable: boolean };
  /**
   * "Customize code" for built-in blocks: creates an editable component from the block. Omit to
   * hide the button (callers pass it only when `editCode` is allowed and a handler exists).
   */
  readonly onEjectBlock?: (
    block: BlockDefinition,
  ) => Promise<{ readonly componentId: string; readonly componentVersion: number } | null>;
}

function EjectControl({
  block,
  bundle,
  onEject,
  onEdit,
}: {
  readonly block: BlockDefinition;
  readonly bundle: BoardBundle;
  readonly onEject: NonNullable<InspectorProps["onEjectBlock"]>;
  readonly onEdit: EditHandler;
}): ReactElement {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const run = async (): Promise<void> => {
    setPending(true);
    setFailure(null);
    try {
      const component = await onEject(block);
      if (component) {
        onEdit(ejectBlockToComponent(bundle, block.id, component), {
          announce: `${block.name} is now a custom component. Press Ctrl+Z to undo.`,
        });
      }
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not create the component.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="boards-field">
      <button
        type="button"
        className="boards-btn"
        disabled={pending}
        aria-busy={pending}
        onClick={() => void run()}
      >
        {pending ? "Creating component…" : "Customize code"}
      </button>
      <p className="boards-help">
        Turns this block into an editable custom component. Same place and settings on the board.
      </p>
      {failure ? (
        <p className="boards-field-error" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Properties inspector: block name, configuration (generated from the block config descriptors),
 * visibility condition, and precise/keyboard layout controls. With no selection it edits the board.
 */
export function Inspector({
  bundle,
  block,
  item,
  breakpoint,
  validator,
  onEdit,
  displayName,
  code,
  onEjectBlock,
}: InspectorProps): ReactElement {
  const nameId = useId();
  const boardNameId = useId();
  const boardDescId = useId();

  if (!block) {
    return (
      <section aria-label="Board settings" className="boards-pane">
        <h2>Board settings</h2>
        <p className="boards-help">Select a block to edit it.</p>
        <div className="boards-field">
          <label htmlFor={boardNameId}>Board name</label>
          <input
            id={boardNameId}
            className="boards-input"
            maxLength={200}
            value={bundle.definition.name}
            onChange={(event) =>
              onEdit(
                { ...bundle, definition: { ...bundle.definition, name: event.target.value } },
                { key: "board:name" },
              )
            }
          />
        </div>
        <div className="boards-field">
          <label htmlFor={boardDescId}>Description</label>
          <textarea
            id={boardDescId}
            className="boards-textarea"
            maxLength={2000}
            value={bundle.definition.description ?? ""}
            onChange={(event) =>
              onEdit(
                {
                  ...bundle,
                  definition: {
                    ...bundle.definition,
                    description: event.target.value === "" ? null : event.target.value,
                  },
                },
                { key: "board:description" },
              )
            }
          />
        </div>
      </section>
    );
  }

  const issues = validateConfig(block.type, block.config);
  const fields = blockConfigFields[block.type] as readonly AnyField[];

  const settings = (
    <>
      <div className="boards-field">
        <label htmlFor={nameId}>Block name</label>
        <input
          id={nameId}
          className="boards-input"
          maxLength={200}
          value={block.name}
          onChange={(event) =>
            onEdit(updateBlock(bundle, block.id, { name: event.target.value }), {
              key: `name:${block.id}`,
            })
          }
        />
      </div>

      <fieldset className="boards-fieldset">
        <legend>Configuration</legend>
        {fields.length === 0 ? <p className="boards-help">No configuration.</p> : null}
        {fields.map((field) => (
          <ConfigControl
            key={field.key}
            field={field}
            block={block}
            bundle={bundle}
            onEdit={onEdit}
          />
        ))}
        {issues.length > 0 ? (
          <ul role="alert" className="boards-field-error">
            {issues.map((issue) => (
              <li key={issue.key}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <ConditionEditor
        label="Visibility condition"
        value={block.visibilityExpression}
        validator={validator}
        definitionId={bundle.definition.id}
        revision={bundle.definition.version}
        onChange={(next) =>
          onEdit(updateBlock(bundle, block.id, { visibilityExpression: next }), {
            key: `vis:${block.id}`,
          })
        }
      />

      {item ? (
        <fieldset className="boards-fieldset">
          <legend>Position and size ({breakpoint})</legend>
          <div className="boards-row">
            <NumberInput
              label="Column"
              value={item.x + 1}
              min={1}
              max={GRID_COLUMNS}
              onChange={(v) =>
                onEdit(moveBlockTo(bundle, breakpoint, block.id, { ...item, x: v - 1 }), {
                  key: `pos:${block.id}`,
                })
              }
            />
            <NumberInput
              label="Row"
              value={item.y + 1}
              min={1}
              max={999}
              onChange={(v) =>
                onEdit(moveBlockTo(bundle, breakpoint, block.id, { ...item, y: v - 1 }), {
                  key: `pos:${block.id}`,
                })
              }
            />
            <NumberInput
              label="Width"
              value={item.width}
              min={1}
              max={GRID_COLUMNS}
              onChange={(v) =>
                onEdit(moveBlockTo(bundle, breakpoint, block.id, { ...item, width: v }), {
                  key: `pos:${block.id}`,
                })
              }
            />
            <NumberInput
              label="Height"
              value={item.height}
              min={1}
              max={99}
              onChange={(v) =>
                onEdit(moveBlockTo(bundle, breakpoint, block.id, { ...item, height: v }), {
                  key: `pos:${block.id}`,
                })
              }
            />
          </div>
          <fieldset className="boards-row boards-plain-fieldset">
            <legend className="boards-visually-hidden">Nudge block</legend>
            {(
              [
                ["Move left", { dx: -1 }],
                ["Move right", { dx: 1 }],
                ["Move up", { dy: -1 }],
                ["Move down", { dy: 1 }],
                ["Narrower", { dw: -1 }],
                ["Wider", { dw: 1 }],
                ["Shorter", { dh: -1 }],
                ["Taller", { dh: 1 }],
              ] as const
            ).map(([label, delta]) => (
              <button
                key={label}
                type="button"
                className="boards-btn"
                onClick={() =>
                  onEdit(nudgeBlock(bundle, breakpoint, block.id, delta), {
                    announce: `${block.name}: ${label.toLowerCase()}.`,
                  })
                }
              >
                {label}
              </button>
            ))}
          </fieldset>
          <div className="boards-field">
            <label>
              <input
                type="checkbox"
                checked={item.hidden}
                onChange={(event) =>
                  onEdit(setBlockHidden(bundle, breakpoint, block.id, event.target.checked), {
                    announce: `${block.name} ${event.target.checked ? "hidden" : "shown"} on ${breakpoint}.`,
                  })
                }
              />{" "}
              Hide on {breakpoint}
            </label>
          </div>
        </fieldset>
      ) : null}

      <button
        type="button"
        className="boards-btn boards-btn-danger"
        onClick={() =>
          onEdit(removeBlock(bundle, block.id), {
            announce: `Removed ${block.name}. Press Ctrl+Z to undo.`,
          })
        }
      >
        Remove “{block.name}”
      </button>
      {onEjectBlock && block.type !== "custom-component" ? (
        <EjectControl block={block} bundle={bundle} onEject={onEjectBlock} onEdit={onEdit} />
      ) : null}
    </>
  );

  return (
    <section aria-label={`Properties of ${block.name}`} className="boards-pane">
      <h2>{displayName}</h2>
      {code ? (
        <Tabs defaultValue="settings">
          <TabsList aria-label="Block editor">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="boards-pane">
            {settings}
          </TabsContent>
          <TabsContent value="code">
            <BlockCodeView bundle={bundle} block={block} editable={code.editable} onEdit={onEdit} />
          </TabsContent>
        </Tabs>
      ) : (
        settings
      )}
    </section>
  );
}
