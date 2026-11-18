# ArgusOS design principles

ArgusOS is used during emergencies, often for long shifts, on EOC workstations, tablets and video walls. The interface has to be calm, fast to read and honest about what it knows. These principles turn that into rules; the tokens in `packages/ui/src/tokens.ts` / `tokens.css` encode them, and [COMPONENTS.md](./COMPONENTS.md) documents the building blocks.

## 1. Calm under pressure
- **Neutral first.** Surfaces are cool greys; one accent (blue, tenant-overridable) marks interactive and selected things. No gradients, glass or decorative colour on data surfaces.
- **Colour means status.** Five locked status tones — `info`, `success`, `warning`, `high`, `critical` — plus `neutral` for stale/unknown. Tenants cannot change them, so a red octagon means the same thing on every board.
- **Never colour alone.** Status always pairs colour with an icon shape *and* a text label (`StatusPill`). Errors in forms show an icon and text. Switches show "On/Off".

## 2. Hierarchy you can scan
- **Type:** Inter (variable, self-hosted via fontsource — no CDN, works offline) for UI; JetBrains Mono for ids, coordinates and times. Numbers are tabular everywhere they line up.
- **Scale:** 12 / 13 / **14 (body)** / 16 / 18 / 20 / 24 / 30 px. One `h1` per route (24px semibold, `PageHeader`); panels use 16px semibold titles; section labels are 12px uppercase tracking-wide in muted colour.
- **Three text weights only:** `fg` for content, `fg-muted` for supporting text, `fg-subtle` for hints and empty values. All three pass 4.5:1 on every surface.
- **Elevation is information.** `canvas` (app background) → `surface` (cards/panels, 1px border, optional `shadow-sm`) → `surface-raised` (menus, popovers `shadow-md`, dialogs `shadow-lg`). Borders are always crisp 1px; shadows are soft and small.

## 3. Dense but legible
- **4px spacing grid.** Density tokens change spacing, control height (36 → 30px) and row height (40 → 30px), never text below 13px.
- **Comfortable** for occasional users; **compact** for the duty officer with 20 panels open. Coarse pointers (tablets, phones) always get 44px targets regardless of density.
- **Radii:** 4px for controls and cells, 8px for cards, panels and menus, 12px for dialogs; none on video wall layouts.

## 4. Always current, always honest
- The top bar always shows **incident, level, operational period, position** and **connection state**. Unknown values say **"Not selected"**; disconnected data says so (`ConnectionIndicator`, `ErrorState`). We never show sample numbers or rows as if they were real.
- Live changes inform without moving things: new rows wait behind an "N new" pill; changed values flash briefly (`FlashOnChange`); conflicts show both values and ask (`ConflictBanner`).
- Loading uses skeletons shaped like the content, not page-blocking spinners. Empty states say what the area is, why it's empty and the next action.

## 5. Motion informs, it doesn't decorate
- 120–200ms, ease-out, only for change (row flash, new-item pill, panel/menu open) and attention (a newly raised critical status may pulse gently).
- `prefers-reduced-motion` sets every duration to zero in CSS, and Motion is configured with `reducedMotion="user"`.

## 6. Keyboard-first and accessible (WCAG 2.2 AA)
- Every interactive element has a visible 2px `focus` ring (≥3:1 in all themes). Everything is reachable by keyboard; ⌘K / Ctrl+K opens the command palette from anywhere; a skip link jumps to content.
- Radix primitives provide focus trapping, Escape-to-close and focus return for dialogs, menus, popovers and selects. Icon-only buttons require a label and show a tooltip.
- Live updates use `aria-live="polite"`; only critical toasts are assertive.
- Contrast for every token pair in light, dark and high-contrast is verified by `packages/ui/src/tokens.test.ts`, so a palette change that breaks AA fails CI.

## 7. One system everywhere
- Light, dark (recommended for EOC rooms) and high-contrast themes; "System" follows the OS. Web, board blocks, mobile and video wall share these tokens.
- Tailwind's default palette is disabled — use role utilities (`bg-surface`, `text-fg-muted`, `bg-critical-subtle`…). If you need a colour that doesn't exist, it's a design-system change, not a one-off.

## Checklist for a new screen
1. `PageContainer` → `PageHeader` (title, one-line description, primary action) → `Panel`s.
2. Every data area handles loading (skeleton), empty (what + next action), error (what failed + retry), offline/stale and permission-hidden (render nothing).
3. Status uses `StatusPill`; times show timezone and relative age; ids and coordinates use mono.
4. Works in compact density, dark and high-contrast, at 390 / 768 / 1280 / 1920px, with keyboard only.
5. No fabricated operational data, ever.
