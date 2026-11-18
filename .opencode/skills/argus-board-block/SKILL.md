---

name: argus-board-block
description: How to add or implement a board block (list, stat tile, map, chart, button, form field...) for the no-code board builder in packages/blocks. Load for any board builder or block work.
---

# Board blocks

A block is one folder in `packages/blocks/src/<block>/` implementing `BlockModule` from `@argus/schema`.

## Files

| File               | Exports                     | Job                                                                               |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------- |
| `definition.ts`    | `<block>Block: BlockModule` | id, label, icon, category, default size, props schema                             |
| `props.ts`         | `propsSchema`               | Zod schema of the block's configurable props (what the inspector edits)           |
| `render.tsx`       | `Render`                    | Runtime component used on live boards                                             |
| `inspector.tsx`    | `Inspector`                 | Properties panel in the builder (auto-generated from props schema where possible) |
| `preview.tsx`      | `Preview`                   | Lightweight palette/drag preview                                                  |
| `<block>.test.tsx` | —                           | Render with sample data, permission states, empty/loading/error                   |

Register in `packages/blocks/src/registry.ts`.

## Rules

- Props are plain JSON (stored in the board definition). No functions, no class instances.
- Logic (visibility, defaults, validation) uses CEL strings evaluated with `@argus/expr`. Never `eval` or `new Function`.
- Data comes from the board's data source via the live-query hook `useLiveQuery` from `@argus/sdk`. Blocks never call fetch directly.
- Every block handles: loading, empty, error, read-only, hidden, and "preview as position".
- Layout: blocks declare `minW/minH/defaultW/defaultH` on the 12-column grid and must render at phone width.
- Use `@argus/ui` components and design tokens only. No hard-coded colours or spacing.

## Done when

Typecheck and tests pass for `@argus/blocks`, and the block renders in Storybook (`packages/ui` stories) with sample data.
