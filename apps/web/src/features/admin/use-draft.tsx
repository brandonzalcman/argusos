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

/** Save button, visible save state, and keep-mine / keep-theirs conflict actions. */
export function DraftToolbar<T extends { readonly version: number }>({
  controller,
  disabled = false,
  conflictSummary,
}: {
  readonly controller: DraftController<T>;
  readonly disabled?: boolean;
  readonly conflictSummary?: string;
}): ReactElement {
  const { dirty, saveState, saveError, conflict, save, keepMine, keepTheirs, baseVersion } =
    controller;
  return (
    <div className="argus-stack" style={{ gap: "0.5rem" }}>
      <div className="argus-cluster">
        <button
          type="button"
          onClick={save}
          disabled={disabled || !dirty || saveState === "saving"}
        >
          Save draft
        </button>
        <SaveStatus state={saveState} error={saveError} />
        {dirty ? <span role="status">● Unsaved changes</span> : null}
        <span className="argus-muted" style={{ fontFamily: "var(--argus-font-mono)" }}>
          base v{baseVersion}
        </span>
      </div>
      {conflict ? (
        <section role="alert" className="argus-panel">
          <h2 style={{ marginTop: 0 }}>Changes need review</h2>
          <p>
            Someone saved a newer version. Your edits were not overwritten.
            {conflictSummary ? ` ${conflictSummary}` : ""}
          </p>
          <div className="argus-cluster">
            <button type="button" onClick={keepTheirs}>
              Keep theirs (discard my edits)
            </button>
            <button type="button" onClick={keepMine}>
              Keep mine (rebase onto v{conflict.version})
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
