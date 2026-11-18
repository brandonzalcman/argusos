import { MotionConfig } from "motion/react";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Density, ThemeMode } from "../tokens.js";

/** `system` follows the OS light/dark preference. */
export type ThemePreference = ThemeMode | "system";

export interface UIPreferences {
  readonly theme: ThemePreference;
  /** The mode actually applied after resolving `system`. */
  readonly resolvedTheme: ThemeMode;
  readonly density: Density;
  readonly setTheme: (theme: ThemePreference) => void;
  readonly setDensity: (density: Density) => void;
}

const PreferencesContext = createContext<UIPreferences | null>(null);

const STORAGE_KEY = "argus.ui.preferences";

interface StoredPreferences {
  readonly theme?: ThemePreference;
  readonly density?: Density;
}

const themeValues: readonly ThemePreference[] = ["system", "light", "dark", "high-contrast"];
const densityValues: readonly Density[] = ["comfortable", "compact"];

function readStored(): StoredPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    const theme = themeValues.find((value) => value === record.theme);
    const density = densityValues.find((value) => value === record.density);
    return { ...(theme ? { theme } : {}), ...(density ? { density } : {}) };
  } catch {
    return {};
  }
}

function writeStored(value: StoredPreferences): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, policy); preferences still apply for the session.
  }
}

function systemPrefersDark(): boolean {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export interface UIPreferencesProviderProps {
  readonly children: ReactNode;
  readonly defaultTheme?: ThemePreference;
  readonly defaultDensity?: Density;
  /** Remember choices in this browser (per-viewer convenience). Defaults to true. */
  readonly persist?: boolean;
  /** Element receiving `data-argus-mode`/`data-argus-density`. Defaults to <html>. */
  readonly target?: HTMLElement | null;
}

/**
 * Applies theme and density to the document and exposes them to controls. Also configures Motion
 * to honour `prefers-reduced-motion`.
 * TODO(implementation): sync preferences to the audited per-user settings API once it exists;
 * localStorage is only a per-browser convenience.
 */
export function UIPreferencesProvider({
  children,
  defaultTheme = "system",
  defaultDensity = "comfortable",
  persist = true,
  target,
}: UIPreferencesProviderProps): ReactElement {
  const [stored] = useState<StoredPreferences>(() => (persist ? readStored() : {}));
  const [theme, setThemeState] = useState<ThemePreference>(stored.theme ?? defaultTheme);
  const [density, setDensityState] = useState<Density>(stored.density ?? defaultDensity);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) {
      return undefined;
    }
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ThemeMode = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const element = target ?? globalThis.document?.documentElement;
    if (!element) {
      return;
    }
    element.dataset.argusMode = resolvedTheme;
    element.dataset.argusDensity = density;
  }, [resolvedTheme, density, target]);

  useEffect(() => {
    if (persist) {
      writeStored({ theme, density });
    }
  }, [persist, theme, density]);

  const setTheme = useCallback((value: ThemePreference) => setThemeState(value), []);
  const setDensity = useCallback((value: Density) => setDensityState(value), []);

  const value = useMemo<UIPreferences>(
    () => ({ theme, resolvedTheme, density, setTheme, setDensity }),
    [theme, resolvedTheme, density, setTheme, setDensity],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </PreferencesContext.Provider>
  );
}

/** Current theme/density and setters. Must be used beneath UIPreferencesProvider. */
export function useUIPreferences(): UIPreferences {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("useUIPreferences must be used within UIPreferencesProvider");
  }
  return value;
}
