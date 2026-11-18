import type { StudioPermissions } from "@argus/schema";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useSessionSnapshot } from "./session.js";

const STORAGE_KEY = "argus.devMode";

const noPermissions: StudioPermissions = {
  viewStudio: false,
  editDefinitions: false,
  publishDefinitions: false,
  editCode: false,
};

export interface DevModeState {
  /** The signed-in position may use dev mode (server-authoritative StudioPermissions). */
  readonly available: boolean;
  /** Dev mode is switched on (and available). */
  readonly enabled: boolean;
  readonly setEnabled: (enabled: boolean) => void;
  readonly permissions: StudioPermissions;
}

const DevModeContext = createContext<DevModeState>({
  available: false,
  enabled: false,
  setEnabled: () => undefined,
  permissions: noPermissions,
});

function readStored(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function writeStored(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable: dev mode still toggles for this session.
  }
}

/**
 * Dev mode = in-app builder affordances (edit buttons on boards/pages, studio navigation, code
 * views). The on/off switch is a per-browser convenience; *availability* comes only from the
 * session's StudioPermissions, and every studio API call is re-authorized on the server.
 */
export function DevModeProvider({ children }: { readonly children: ReactNode }): ReactElement {
  const { snapshot } = useSessionSnapshot();
  const permissions = snapshot?.studio ?? noPermissions;
  const available = permissions.viewStudio;
  const [stored, setStored] = useState(readStored);
  const setEnabled = useCallback((value: boolean) => {
    setStored(value);
    writeStored(value);
  }, []);
  const value = useMemo<DevModeState>(
    () => ({ available, enabled: available && stored, setEnabled, permissions }),
    [available, stored, setEnabled, permissions],
  );
  return <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>;
}

export function useDevMode(): DevModeState {
  return useContext(DevModeContext);
}
