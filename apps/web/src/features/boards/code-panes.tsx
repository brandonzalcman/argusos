import type { DefinitionIssue } from "@argus/schema";
import { type ReactElement, useCallback, useId } from "react";
import { DefinitionCodeView } from "../studio/code-view.js";
import {
  blockCodeSchema,
  boardBundleCodeSchema,
  changesBundle,
  replaceBlock,
  replaceBundle,
  validateBlockSemantics,
  validateBundleSemantics,
} from "./code-mode.js";
import type { BlockDefinition, BoardBundle } from "./model.js";

type EditHandler = (next: BoardBundle, options?: { key?: string; announce?: string }) => void;

/** Whole-board code (definition + layout) validated with `boardBundleSchema` plus semantic checks. */
export function BundleCodeView({
  bundle,
  editable,
  onEdit,
}: {
  readonly bundle: BoardBundle;
  readonly editable: boolean;
  /** Receives the replaced bundle; the page dispatches it as ONE builder edit (one undo step). */
  readonly onEdit: EditHandler;
}): ReactElement {
  const extraValidate = useCallback(
    (next: BoardBundle): readonly DefinitionIssue[] => validateBundleSemantics(next, bundle),
    [bundle],
  );
  const onApply = useCallback(
    (next: BoardBundle): void => {
      // Re-check at the boundary: invalid text never touches the draft.
      const result = replaceBundle(bundle, next);
      if (!result.ok || !changesBundle(bundle, result.bundle)) return;
      onEdit(result.bundle, { announce: "Board code applied. Press Ctrl+Z to undo." });
    },
    [bundle, onEdit],
  );
  return (
    <DefinitionCodeView<BoardBundle>
      value={bundle}
      // The Zod output and the blocks-derived BoardBundle describe the same document.
      schema={
        boardBundleCodeSchema as unknown as Parameters<
          typeof DefinitionCodeView<BoardBundle>
        >[0]["schema"]
      }
      label="Board definition code"
      editable={editable}
      onApply={onApply}
      extraValidate={extraValidate}
      minHeight="28rem"
      maxHeight="calc(100vh - 14rem)"
    />
  );
}

/** One block's code, validated with `blockDefinitionSchema`; the id may not change. */
export function BlockCodeView({
  bundle,
  block,
  editable,
  onEdit,
}: {
  readonly bundle: BoardBundle;
  readonly block: BlockDefinition;
  readonly editable: boolean;
  readonly onEdit: EditHandler;
}): ReactElement {
  const blockId = block.id;
  const extraValidate = useCallback(
    (next: BlockDefinition): readonly DefinitionIssue[] => validateBlockSemantics(next, blockId),
    [blockId],
  );
  const onApply = useCallback(
    (next: BlockDefinition): void => {
      const result = replaceBlock(bundle, blockId, next);
      if (!result.ok || !changesBundle(bundle, result.bundle)) return;
      onEdit(result.bundle, { announce: `${next.name} code applied. Press Ctrl+Z to undo.` });
    },
    [bundle, blockId, onEdit],
  );
  return (
    <DefinitionCodeView<BlockDefinition>
      value={block}
      schema={
        blockCodeSchema as unknown as Parameters<
          typeof DefinitionCodeView<BlockDefinition>
        >[0]["schema"]
      }
      label={`Code for block ${block.name}`}
      editable={editable}
      onApply={onApply}
      extraValidate={extraValidate}
      minHeight="16rem"
      maxHeight="60vh"
    />
  );
}

export type BuilderMode = "design" | "code";

const modes: readonly { value: BuilderMode; label: string }[] = [
  { value: "design", label: "Design" },
  { value: "code", label: "Code" },
];

/**
 * Segmented "Design | Code" switch with radio-group semantics: native radios give arrow-key
 * movement and a single tab stop; the visible label is the styled segment.
 */
export function ModeSwitch({
  value,
  onChange,
}: {
  readonly value: BuilderMode;
  readonly onChange: (mode: BuilderMode) => void;
}): ReactElement {
  const name = useId();
  return (
    <fieldset className="boards-segmented" aria-label="Builder mode">
      {modes.map((mode) => (
        <label key={mode.value} className="boards-segment">
          <input
            type="radio"
            name={name}
            value={mode.value}
            checked={value === mode.value}
            onChange={() => onChange(mode.value)}
          />
          <span>{mode.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Code-mode replacement for the palette: pick a block to edit in the inspector. */
export function BlockPicker({
  blocks,
  selectedId,
  onSelect,
}: {
  readonly blocks: readonly BlockDefinition[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}): ReactElement {
  if (blocks.length === 0) return <p className="boards-help">This board has no blocks.</p>;
  return (
    <ul className="grid gap-1" aria-label="Board blocks">
      {blocks.map((block) => (
        <li key={block.id}>
          <button
            type="button"
            className="boards-btn boards-block-pick"
            aria-pressed={selectedId === block.id}
            onClick={() => onSelect(block.id)}
          >
            <span>{block.name}</span>
            <span className="boards-help">{block.type}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
