import type {
  BlockType,
  StudioCreateTemplate,
  StudioDefinitionKind,
  StudioDefinitionSummary,
} from "@argus/schema";
import { blockTypeSchema, definitionKeySchema } from "@argus/schema";
import { Button, DialogContent, Field, Input, Select } from "@argus/ui";
import { coreBlockRegistry } from "@argus/blocks";
import { type FormEvent, type ReactElement, useId, useState } from "react";
import { kindLabels, suggestKey } from "./studio-links.js";

type TemplateType = StudioCreateTemplate["type"];

export interface CreateDefinitionRequest {
  readonly kind: StudioDefinitionKind;
  readonly name: string;
  readonly key: string;
  readonly template: StudioCreateTemplate;
}

export interface CreateDefinitionDialogProps {
  readonly kind: StudioDefinitionKind;
  /** Existing definitions of the same kind, offered as "duplicate" sources. */
  readonly existing: readonly StudioDefinitionSummary[];
  readonly pending: boolean;
  readonly error: string | null;
  readonly onSubmit: (request: CreateDefinitionRequest) => void;
}

const templateOptions: Readonly<
  Record<StudioDefinitionKind, readonly { value: TemplateType; label: string }[]>
> = {
  board: [
    { value: "blank", label: "Blank board" },
    { value: "from-table", label: "Generate from a table" },
    { value: "duplicate", label: "Duplicate an existing board" },
  ],
  page: [
    { value: "blank", label: "Blank page" },
    { value: "from-table", label: "Generate from a table" },
    { value: "duplicate", label: "Duplicate an existing page" },
  ],
  component: [
    { value: "blank", label: "Blank component" },
    { value: "eject-block", label: "Start from a built-in block" },
    { value: "duplicate", label: "Duplicate an existing component" },
  ],
};

const blockOptions = blockTypeSchema.options
  .filter((type) => type !== "custom-component")
  .map((type) => ({ value: type, label: coreBlockRegistry.get(type)?.displayName ?? type }));

/** Dialog body for creating a board, page or component draft (wrap in a `Dialog`). */
export function CreateDefinitionDialog({
  kind,
  existing,
  pending,
  error,
  onSubmit,
}: CreateDefinitionDialogProps): ReactElement {
  const formId = useId();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [template, setTemplate] = useState<TemplateType>("blank");
  const [tableId, setTableId] = useState("");
  const [blockType, setBlockType] = useState<BlockType>("stat");
  const [sourceId, setSourceId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const effectiveKey = keyTouched ? key : suggestKey(name);
  const keyValid = definitionKeySchema.safeParse(effectiveKey).success;
  const nameError = submitted && name.trim() === "" ? "Enter a name." : undefined;
  const keyError =
    submitted && !keyValid
      ? "Use lower_snake_case: a letter, then letters, digits or underscores."
      : undefined;
  const tableError =
    submitted && template === "from-table" && tableId.trim() === "" ? "Choose a table." : undefined;
  const sourceError =
    submitted && template === "duplicate" && sourceId === "" ? "Choose what to duplicate." : undefined;

  const buildTemplate = (): StudioCreateTemplate | null => {
    switch (template) {
      case "blank":
        return { type: "blank" };
      case "from-table":
        return tableId.trim() ? { type: "from-table", tableId: tableId.trim() } : null;
      case "eject-block":
        return { type: "eject-block", blockType };
      case "duplicate":
        return sourceId ? { type: "duplicate", sourceId } : null;
    }
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmitted(true);
    const built = buildTemplate();
    if (name.trim() === "" || !keyValid || !built) return;
    onSubmit({ kind, name: name.trim(), key: effectiveKey, template: built });
  };

  const label = kindLabels[kind].singular;
  return (
    <DialogContent
      title={`New ${label.toLowerCase()}`}
      description="It starts as a draft. Nothing is visible to other positions until you publish."
      preventOutsideClose={pending}
      footer={
        <Button type="submit" form={formId} variant="primary" loading={pending}>
          Create draft
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Name" required error={nameError}>
          <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>
        <Field
          label="Key"
          description="Stable identifier used in expressions, packs and the API."
          required
          error={keyError}
        >
          <Input
            mono
            value={effectiveKey}
            onChange={(event) => {
              setKeyTouched(true);
              setKey(event.target.value);
            }}
          />
        </Field>
        <Field label="Start from">
          <Select
            value={template}
            onValueChange={(value) => setTemplate(value as TemplateType)}
            options={templateOptions[kind]}
          />
        </Field>
        {template === "from-table" ? (
          <Field
            label="Table"
            description="Table id. TODO(implementation): table picker from the table catalog."
            required
            error={tableError}
          >
            <Input mono value={tableId} onChange={(event) => setTableId(event.target.value)} />
          </Field>
        ) : null}
        {template === "eject-block" ? (
          <Field
            label="Built-in block"
            description="You get an editable copy of its interface code; the original block is unchanged."
          >
            <Select
              value={blockType}
              onValueChange={(value) => setBlockType(value as BlockType)}
              options={blockOptions}
            />
          </Field>
        ) : null}
        {template === "duplicate" ? (
          <Field label={`${label} to duplicate`} required error={sourceError}>
            <Select
              value={sourceId}
              onValueChange={setSourceId}
              placeholder={existing.length === 0 ? "Nothing to duplicate yet" : "Choose…"}
              disabled={existing.length === 0}
              options={existing.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Field>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-critical">
            {error}
          </p>
        ) : null}
      </form>
    </DialogContent>
  );
}
