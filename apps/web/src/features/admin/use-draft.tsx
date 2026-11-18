import { Badge, Button, ConflictBanner, type ConflictField } from "@argus/ui";
import { Save } from "@argus/ui/icons";
import { type ReactElement, useCallback, useEffect, useState } from "react";
import { type SaveState, SaveStatus } from "../workflows/status-views.js";
import { DefinitionConflictError } from "./admin-service.js";

export interface DraftController<T> {
  readonly draft: T;
  readonly baseVersion: number;
  readonly dirty: boolean;
  readonly saveState: SaveState;
  readonly saveError: unknown;
  readonly conflict: T | null;
  readonly edit: (update: (current: T) => T) => void;
  readonly save: () => void;
  readonly keepTheirs: () => void;
  readonly keepMine: () => void;
}

/**
 * Local draft state with optimistic versioning and conflict handling for a server definition.
 * Input: the server value and a save function receiving (expectedVersion, draft).
 * Output: controller state; saves send expectedVersion = the last server version seen.
 * Errors: DefinitionConflictError sets `conflict`; other rejections set saveError.
 * Newer server versions replace the draft only while there are no unsaved edits.
 */
export function useDraft<T extends { readonly version: number }>(
  server: T,
  persist: (expectedVersion: number, draft: T) => Promise<T>,
): DraftController<T> {
  const [draft, setDraft] = useState<T>(server);
  const [baseVersion, setBaseVersion] = useState(server.version);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<unknown>(null);
  const [conflict, setConflict] = useState<T | null>(null);

  useEffect(() => {
    if (!dirty && server.version !== baseVersion) {
      setDraft(server);
      setBaseVersion(server.version);
    }
  }, [server, dirty, baseVersion]);

  const edit = useCallback((update: (current: T) => T) => {
    setDraft(update);
    setDirty(true);
    setSaveState("idle");
  }, []);

  const save = useCallback(() => {
    setSaveState("saving");
    persist(baseVersion, draft).then(
      (saved) => {
        setDraft(saved);
        setBaseVersion(saved.version);
        setDirty(false);
        setConflict(null);
        setSaveState("saved");
      },
      (error: unknown) => {
        if (error instanceof DefinitionConflictError) {
          setConflict(error.serverDefinition as T);
          setSaveState("conflict");
        } else {
          setSaveError(error);
          setSaveState("error");
        }
      },
    );
  }, [persist, baseVersion, draft]);

  const keepTheirs = useCallback(() => {
    if (!conflict) return;
    setDraft(conflict);
    setBaseVersion(conflict.version);
    setDirty(false);
    setConflict(null);
    setSaveState("idle");
  }, [conflict]);

  const keepMine = useCallback(() => {
    if (!conflict) return;
    setBaseVersion(conflict.version);
    setConflict(null);
    setSaveState("idle");
  }, [conflict]);

  return {
    draft,
    baseVersion,
    dirty,
    saveState,
    saveError,
    conflict,
    edit,
    save,
    keepTheirs,
    keepMine,
  };
}

/** Header actions for a draft: visible save state, version, and the primary Save button. */
export function DraftActions<T extends { readonly version: number }>({
  controller,
  disabled = false,
}: {
  readonly controller: DraftController<T>;
  readonly disabled?: boolean;
}): ReactElement {
  const { dirty, saveState, saveError, save, baseVersion } = controller;
  return (
    <>
      <SaveStatus state={saveState} error={saveError} />
      {dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
      <Badge tone="neutral">Version {baseVersion}</Badge>
      <Button
        variant="primary"
        leadingIcon={<Save aria-hidden="true" />}
        loading={saveState === "saving"}
        disabled={disabled || !dirty}
        onClick={save}
      >
        Save draft
      </Button>
    </>
  );
}

/** Both-values conflict banner with keep-mine / keep-theirs, shown only while a conflict exists. */
export function DraftConflict<T extends { readonly version: number }>({
  controller,
  recordLabel,
  describe,
}: {
  readonly controller: DraftController<T>;
  readonly recordLabel: string;
  /** Field-level local/server values to compare (redact anything the viewer may not see). */
  readonly describe: (mine: T, theirs: T) => readonly ConflictField[];
}): ReactElement | null {
  const { conflict, draft, keepMine, keepTheirs } = controller;
  if (!conflict) return null;
  return (
    <ConflictBanner
      recordLabel={recordLabel}
      fields={describe(draft, conflict)}
      onKeepMine={keepMine}
      onKeepTheirs={keepTheirs}
    />
  );
}
