---

name: argus-ui
description: ArgusOS design system and UX rules — tokens, themes, density, live-data states, accessibility, layouts for EOC desks, phones and video walls. Load for any UI, component, screen, block or styling work.
---

# ArgusOS UI

## Principles

1. **Calm under pressure.** Few colours, strong hierarchy, nothing decorative. Colour means status, never decoration.
2. **Always current.** Live data is the default; the user must always know if a screen is live, reconnecting or offline.
3. **Dense but legible.** Duty officers run 20 panels at once. Support comfortable and compact density.
4. **Keyboard-first.** Everything reachable without a mouse; ⌘K/Ctrl+K command palette for everything.
5. **Same system everywhere.** Web, mobile, builder and video wall share tokens and components.

## Tokens (`packages/ui/src/tokens.ts`, exposed as CSS variables for Tailwind v4 `@theme`)

- **Colour roles, not raw colours:** `bg`, `bg-raised`, `bg-sunken`, `fg`, `fg-muted`, `border`, `accent`, `focus`.
- **Status scale (fixed meaning across the app):** `status-critical`, `status-high`, `status-medium`, `status-low`, `status-info`, `status-ok`, `status-stale`. Always pair colour with an icon or label (never colour alone).
- **Themes:** `dark` (default, EOC rooms), `light`, `high-contrast`. Tenants can override `accent` and logo only; status colours are locked.
- **Type:** Inter (UI) + JetBrains Mono (ids, times, coordinates). Tabular numbers for all figures and times.
- **Spacing:** 4 px base. Density modes change spacing + row height, not font size below 13 px.
- **Radius:** small (4) for inputs/cells, medium (8) for panels, none for video wall.
- **Motion:** 120–200 ms ease-out, only for change and attention (row flash, panel open). Respect `prefers-reduced-motion`.

## Layout

- App shell: top status bar (active incident, level, operational period, your position, connection status, alerts bell), collapsible side menu, workspace with resizable split panes, pop-out windows.
- 12-column grid for boards; breakpoints 390 / 768 / 1280 / 1920 / video wall (2560+, no chrome, large type).
- Tables use the canvas data grid; pin key columns; sticky headers; status column first.

## Every component handles

loading (skeleton, not spinner, for content) · empty (what it is + primary action) · error (what failed + retry) · read-only · permission-hidden (render nothing, never a disabled ghost of secret data) · offline/reconnecting · live update arriving (brief flash; new rows behind "N new" pill).

## Interaction rules

- Destructive actions: confirm with the item name; undo toast where possible.
- Forms: inline validation from the Zod schema; save state visible (saving / saved / conflict).
- Conflicts: banner showing both values with "keep mine / keep theirs".
- Times: always show timezone and relative age ("14:32 AEDT · 3 min ago").
- Maps and lists of the same data stay selected in sync.

## Accessibility

WCAG 2.2 AA in all themes · visible focus ring (`focus` token, 2 px) · labels from field definitions · `aria-live="polite"` for live updates, `assertive` only for critical alerts · touch targets ≥ 44 px on mobile.

## Tech

React 19 + React Compiler, Radix primitives, Tailwind v4 with tokens, Motion for animation, lucide icons, Glide Data Grid, MapLibre, Storybook for every component (all states as stories).

## Avoid

Gradients and glassmorphism on data surfaces · more than one accent colour · modal-on-modal · spinners blocking whole screens · icon-only buttons without tooltips and labels · layout shift when live data arrives.
