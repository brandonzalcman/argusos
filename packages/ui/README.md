# @argus/ui

ArgusOS design system: tokens, Tailwind 4 theme, accessible Radix-based components, Motion for change/attention, and Storybook.

- **Docs:** [`docs/ui/COMPONENTS.md`](../../docs/ui/COMPONENTS.md) (every component, props, usage, a11y) and [`docs/ui/DESIGN_PRINCIPLES.md`](../../docs/ui/DESIGN_PRINCIPLES.md).
- **Entry points:** `@argus/ui` (components, hooks, tokens), `@argus/ui/icons` (lucide re-export), `@argus/ui/styles.css` (fonts, tokens, Tailwind theme — import once per app).
- **Tokens:** `src/tokens.ts` is canonical; `src/tokens.css` mirrors it. `src/tokens.test.ts` checks the mirror and WCAG 2.2 AA contrast for every pairing in light, dark and high-contrast.

## Scripts

- `pnpm --filter @argus/ui dev` — Storybook on port 6006 (theme and density in the toolbar).
- `pnpm --filter @argus/ui build` — emits `dist/` (TypeScript + CSS copy). Apps consume `dist`, so rebuild after changes.
- `pnpm --filter @argus/ui test` — token contrast, component semantics (SSR) and interaction-logic tests.

## Open items

- TODO(implementation): pop-out windows for `SplitPane` panes (multi-monitor desks).
- TODO(implementation): canvas data-grid adapter (Glide) sharing the table tokens for 50k-row live grids.
- TODO(implementation): persist theme/density through the audited user-settings API (currently per-browser `localStorage`).
- TODO(implementation): tenant theme application (accent + logo override) from `ThemeDefinition`, with AA validation at publish time.
- TODO(implementation): browser-level tests (Storybook interaction + axe, Playwright visual regression); current tests run in Node.
