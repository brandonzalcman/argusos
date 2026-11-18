import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ModePalette,
  palette,
  paletteCssVariables,
  statusCssVariable,
  statusTones,
  type ThemeMode,
} from "./tokens.js";

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const modes = Object.keys(palette) as ThemeMode[];
const TEXT = 4.5;
const GRAPHIC = 3;

describe("palette meets WCAG 2.2 AA", () => {
  describe.each(modes)("%s mode", (mode) => {
    const p: ModePalette = palette[mode];
    const surfaces = {
      bg: p.bg,
      surface: p.surface,
      surfaceSunken: p.surfaceSunken,
      surfaceRaised: p.surfaceRaised,
      surfaceHover: p.surfaceHover,
    };

    it.each(Object.entries(surfaces))("text roles are >= 4.5:1 on %s", (_name, surface) => {
      expect(contrast(p.fg, surface)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(p.fgMuted, surface)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(p.fgSubtle, surface)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(p.accentText, surface)).toBeGreaterThanOrEqual(TEXT);
    });

    it("component boundaries and focus ring are >= 3:1", () => {
      expect(contrast(p.borderStrong, p.surface)).toBeGreaterThanOrEqual(GRAPHIC);
      expect(contrast(p.borderStrong, p.bg)).toBeGreaterThanOrEqual(GRAPHIC);
      expect(contrast(p.focus, p.surface)).toBeGreaterThanOrEqual(GRAPHIC);
      expect(contrast(p.focus, p.bg)).toBeGreaterThanOrEqual(GRAPHIC);
      expect(contrast(p.accent, p.surface)).toBeGreaterThanOrEqual(GRAPHIC);
    });

    it("accent buttons and accent-subtle highlights are readable", () => {
      expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(p.onAccent, p.accentHover)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(p.accentText, p.accentSubtle)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(p.fg, p.accentSubtle)).toBeGreaterThanOrEqual(TEXT);
    });

    it.each(statusTones)("%s tone text, solid fill and graphic colours pass", (tone) => {
      const t = p.status[tone];
      expect(contrast(t.fg, t.subtle)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(t.fg, p.surface)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(t.fg, p.bg)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(t.fg, p.surfaceRaised)).toBeGreaterThanOrEqual(TEXT);
      // Solid badges use the tone colour as fill with surface-coloured text.
      expect(contrast(p.surface, t.fg)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(t.solid, p.surface)).toBeGreaterThanOrEqual(GRAPHIC);
    });
  });
});

describe("tokens.css mirrors tokens.ts", () => {
  const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

  /** Extracts `--name: value;` declarations from the first block matching `selector {`. */
  function block(selector: string): Map<string, string> {
    const start = css.indexOf(`${selector} {`);
    expect(start, `selector ${selector} present`).toBeGreaterThanOrEqual(0);
    const end = css.indexOf("\n}", start);
    const body = css.slice(start, end);
    return new Map(
      [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
        match[1] ?? "",
        (match[2] ?? "").trim(),
      ]),
    );
  }

  const selectors: Record<ThemeMode, string> = {
    light: ":root",
    dark: ':root[data-argus-mode="dark"]',
    "high-contrast": ':root[data-argus-mode="high-contrast"]',
  };

  it.each(modes)("%s colour variables match the canonical palette", (mode) => {
    const declarations = block(selectors[mode]);
    const p = palette[mode];
    for (const [key, variable] of Object.entries(paletteCssVariables)) {
      expect(declarations.get(variable), variable).toBe(p[key as keyof typeof paletteCssVariables]);
    }
    for (const tone of statusTones) {
      for (const part of ["fg", "subtle", "solid"] as const) {
        expect(declarations.get(statusCssVariable(tone, part))).toBe(p.status[tone][part]);
      }
    }
  });

  it("the OS-dark fallback uses the same dark palette", () => {
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    for (const [key, variable] of Object.entries(paletteCssVariables)) {
      expect(media).toContain(
        `${variable}: ${palette.dark[key as keyof typeof paletteCssVariables]};`,
      );
    }
  });

  it("reduced motion zeroes every motion duration", () => {
    const media = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(media).toMatch(/--argus-duration-fast:\s*0ms/);
    expect(media).toMatch(/--argus-duration-base:\s*0ms/);
    expect(media).toMatch(/--argus-duration-slow:\s*0ms/);
  });
});
