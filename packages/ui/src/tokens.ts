import type { ThemeDefinition, ThemeMode, ThemeTokens } from "@argus/schema";

/** Shared visual modes; tenant themes must preserve WCAG 2.2 AA contrast in every mode. */
export type { ThemeDefinition, ThemeMode } from "@argus/schema";

/** Shared information density for occasional users and dense operations workstations. */
export type Density = ThemeTokens["density"];

/** Alias emphasizing that the published schema definition is the UI theme integration contract. */
export type TenantThemeContract = ThemeDefinition;

/**
 * Semantic tones. Colour always carries meaning (never decoration) and is always paired with an
 * icon and/or text label so no state is communicated by colour alone.
 */
export const tones = [
  "neutral",
  "accent",
  "info",
  "success",
  "warning",
  "high",
  "critical",
] as const;
export type Tone = (typeof tones)[number];

/** Tones that have a dedicated status palette (neutral and accent reuse surface/accent roles). */
export const statusTones = ["info", "success", "warning", "high", "critical"] as const;
export type StatusTone = (typeof statusTones)[number];

/** Per-tone colour triplet: readable text, tinted background, and a 3:1 graphic/icon colour. */
export interface ToneColors {
  /** Text/icon colour; >= 4.5:1 on `subtle`, `surface` and `bg`. Also the solid-badge fill. */
  readonly fg: string;
  /** Tinted background for pills, banners and highlighted rows. */
  readonly subtle: string;
  /** Graphic colour for dots, borders and indicators; >= 3:1 on `surface`. */
  readonly solid: string;
}

/** Colour roles for one theme mode. Values are hex so contrast can be verified in tests. */
export interface ModePalette {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceSunken: string;
  readonly surfaceRaised: string;
  readonly surfaceHover: string;
  readonly fg: string;
  readonly fgMuted: string;
  readonly fgSubtle: string;
  readonly border: string;
  /** Component boundaries (inputs, checkboxes); >= 3:1 against `surface` and `bg` (WCAG 1.4.11). */
  readonly borderStrong: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly onAccent: string;
  readonly accentText: string;
  readonly accentSubtle: string;
  readonly focus: string;
  readonly status: Readonly<Record<StatusTone, ToneColors>>;
}

/**
 * Canonical palette. `tokens.css` mirrors these values exactly; `tokens.test.ts` verifies the
 * mirror and every WCAG 2.2 AA pairing, so edit both files together.
 * Tenants may override `accent*` and logo only; status colours are locked (product plan §8/§9).
 */
export const palette: Readonly<Record<ThemeMode, ModePalette>> = {
  light: {
    bg: "#f5f6f8",
    surface: "#ffffff",
    surfaceSunken: "#eef0f3",
    surfaceRaised: "#ffffff",
    surfaceHover: "#e9ecf0",
    fg: "#111820",
    fgMuted: "#4b5565",
    fgSubtle: "#5f6978",
    border: "#dde1e6",
    borderStrong: "#868f9c",
    accent: "#2853c7",
    accentHover: "#2147ad",
    onAccent: "#ffffff",
    accentText: "#2449b0",
    accentSubtle: "#e9effb",
    focus: "#2853c7",
    status: {
      info: { fg: "#0a5c80", subtle: "#e5f3f9", solid: "#0e7aa8" },
      success: { fg: "#136a33", subtle: "#e6f4ea", solid: "#1d8a45" },
      warning: { fg: "#7f4d00", subtle: "#fcf2db", solid: "#b37400" },
      high: { fg: "#9c3a06", subtle: "#fdeee3", solid: "#cf5a12" },
      critical: { fg: "#b0201a", subtle: "#fdecea", solid: "#c8271e" },
    },
  },
  dark: {
    bg: "#0c0f13",
    surface: "#13171d",
    surfaceSunken: "#090b0e",
    surfaceRaised: "#1a1f27",
    surfaceHover: "#1e242d",
    fg: "#e7eaee",
    fgMuted: "#a2abb8",
    fgSubtle: "#8c96a4",
    border: "#272e38",
    borderStrong: "#5d6776",
    accent: "#6d9bff",
    accentHover: "#8aafff",
    onAccent: "#0a1020",
    accentText: "#93b6ff",
    accentSubtle: "#172238",
    focus: "#7aa5ff",
    status: {
      info: { fg: "#6ccaf0", subtle: "#0f2430", solid: "#4fb6e0" },
      success: { fg: "#6dd496", subtle: "#0f2618", solid: "#3fb26c" },
      warning: { fg: "#f0c35a", subtle: "#2a2109", solid: "#d9a530" },
      high: { fg: "#ff9e66", subtle: "#2e1a0e", solid: "#f07c3c" },
      critical: { fg: "#ff7a70", subtle: "#331312", solid: "#f2564b" },
    },
  },
  "high-contrast": {
    bg: "#000000",
    surface: "#000000",
    surfaceSunken: "#000000",
    surfaceRaised: "#0d0d0d",
    surfaceHover: "#1f1f1f",
    fg: "#ffffff",
    fgMuted: "#e6e6e6",
    fgSubtle: "#d0d0d0",
    border: "#bfbfbf",
    borderStrong: "#ffffff",
    accent: "#ffd60a",
    accentHover: "#ffe14d",
    onAccent: "#000000",
    accentText: "#ffd60a",
    accentSubtle: "#262000",
    focus: "#ffd60a",
    status: {
      info: { fg: "#8fdcff", subtle: "#001a26", solid: "#8fdcff" },
      success: { fg: "#8ff0b0", subtle: "#001f0d", solid: "#8ff0b0" },
      warning: { fg: "#ffe066", subtle: "#261f00", solid: "#ffe066" },
      high: { fg: "#ffb27a", subtle: "#2b1300", solid: "#ffb27a" },
      critical: { fg: "#ff9c94", subtle: "#2e0300", solid: "#ff9c94" },
    },
  },
};

/** Maps palette keys to CSS custom property names (used by tests and tenant theme tooling). */
export const paletteCssVariables: Readonly<Record<Exclude<keyof ModePalette, "status">, string>> = {
  bg: "--argus-color-bg",
  surface: "--argus-color-surface",
  surfaceSunken: "--argus-color-surface-sunken",
  surfaceRaised: "--argus-color-surface-raised",
  surfaceHover: "--argus-color-surface-hover",
  fg: "--argus-color-fg",
  fgMuted: "--argus-color-fg-muted",
  fgSubtle: "--argus-color-fg-subtle",
  border: "--argus-color-border",
  borderStrong: "--argus-color-border-strong",
  accent: "--argus-color-accent",
  accentHover: "--argus-color-accent-hover",
  onAccent: "--argus-color-on-accent",
  accentText: "--argus-color-accent-text",
  accentSubtle: "--argus-color-accent-subtle",
  focus: "--argus-color-focus",
};

/** CSS variable for one status tone colour, e.g. `--argus-color-critical-subtle`. */
export function statusCssVariable(tone: StatusTone, key: keyof ToneColors): string {
  return key === "fg" ? `--argus-color-${tone}` : `--argus-color-${tone}-${key}`;
}

/** Type scale in rem (16px root). UI body is 14px; nothing operational renders below 12px. */
export const typeScale = {
  xs: { size: "0.75rem", lineHeight: "1rem" },
  sm: { size: "0.8125rem", lineHeight: "1.125rem" },
  base: { size: "0.875rem", lineHeight: "1.25rem" },
  md: { size: "1rem", lineHeight: "1.5rem" },
  lg: { size: "1.125rem", lineHeight: "1.5rem" },
  xl: { size: "1.25rem", lineHeight: "1.75rem" },
  "2xl": { size: "1.5rem", lineHeight: "2rem" },
  "3xl": { size: "1.875rem", lineHeight: "2.25rem" },
} as const;

/** 4px spacing base shared with Tailwind's `--spacing`. */
export const spacingBase = "0.25rem";

export const radii = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  full: "9999px",
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  topBar: 20,
  sidebar: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
  skipLink: 90,
} as const;

export const motionTokens = {
  durationFast: "120ms",
  durationBase: "160ms",
  durationSlow: "200ms",
  easeOut: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** Density changes spacing and row height only; body text never drops below 13px. */
export const densityTokens: Readonly<Record<Density, Readonly<Record<string, string>>>> = {
  comfortable: {
    "--argus-control-h": "2.25rem",
    "--argus-control-h-sm": "1.75rem",
    "--argus-control-h-lg": "2.75rem",
    "--argus-control-px": "0.75rem",
    "--argus-row-h": "2.5rem",
    "--argus-cell-px": "0.75rem",
    "--argus-cell-text": "0.875rem",
    "--argus-panel-p": "1.25rem",
    "--argus-gap": "1rem",
    "--argus-page-p": "1.5rem",
    "--argus-topbar-h": "3.5rem",
  },
  compact: {
    "--argus-control-h": "1.875rem",
    "--argus-control-h-sm": "1.5rem",
    "--argus-control-h-lg": "2.25rem",
    "--argus-control-px": "0.5rem",
    "--argus-row-h": "1.875rem",
    "--argus-cell-px": "0.5rem",
    "--argus-cell-text": "0.8125rem",
    "--argus-panel-p": "0.75rem",
    "--argus-gap": "0.625rem",
    "--argus-page-p": "1rem",
    "--argus-topbar-h": "3rem",
  },
};

/**
 * Stable design-token references for inline styles, canvas renderers (data grid, maps) and board
 * blocks that cannot use Tailwind classes. Prefer Tailwind utilities in components.
 */
export const designTokens = {
  color: {
    bg: "var(--argus-color-bg)",
    surface: "var(--argus-color-surface)",
    surfaceSunken: "var(--argus-color-surface-sunken)",
    surfaceRaised: "var(--argus-color-surface-raised)",
    surfaceHover: "var(--argus-color-surface-hover)",
    fg: "var(--argus-color-fg)",
    fgMuted: "var(--argus-color-fg-muted)",
    fgSubtle: "var(--argus-color-fg-subtle)",
    border: "var(--argus-color-border)",
    borderStrong: "var(--argus-color-border-strong)",
    accent: "var(--argus-color-accent)",
    onAccent: "var(--argus-color-on-accent)",
    accentText: "var(--argus-color-accent-text)",
    focus: "var(--argus-color-focus)",
    info: "var(--argus-color-info)",
    success: "var(--argus-color-success)",
    warning: "var(--argus-color-warning)",
    high: "var(--argus-color-high)",
    critical: "var(--argus-color-critical)",
  },
  radius: {
    sm: "var(--argus-radius-sm)",
    md: "var(--argus-radius-md)",
    lg: "var(--argus-radius-lg)",
  },
  spacing: {
    controlHeight: "var(--argus-control-h)",
    rowHeight: "var(--argus-row-h)",
    panel: "var(--argus-panel-p)",
    gap: "var(--argus-gap)",
    page: "var(--argus-page-p)",
  },
  typography: {
    body: "var(--argus-font-sans)",
    mono: "var(--argus-font-mono)",
  },
  motion: {
    fast: "var(--argus-duration-fast)",
    base: "var(--argus-duration-base)",
    ease: "var(--argus-ease-out)",
  },
} as const;
