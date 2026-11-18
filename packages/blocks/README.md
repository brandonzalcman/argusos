# @argus/blocks

Typed registry and integration contracts for all 20 block kinds in product plan §6.2, plus the 12-column responsive layout and board renderer ports. Renderers intentionally throw; no board engine or sample operational data is included.

## Implementation order

1. Validate each `BlockConfigByKind` entry against the shared `BlockDefinition["config"]` at the integration boundary. Board, block-kind, layout, operation-context, and record types already come from `@argus/schema`.
2. Implement and test layout bounds/collision validation, deterministic breakpoint fallback, keyboard reordering, and optimistic definition versioning.
3. Connect `BoardDataPort` to authorized API/Electric queries and optimistic audited mutations. Preserve tenant, incident, position, view, and field-level policies.
4. Implement foundational field/display/list/layout blocks, then charts/maps/collaboration/external blocks. Embed and rich text require sanitization and sandboxing.
5. Implement CEL visibility/action evaluation and finally the runtime renderer. Add performance, accessibility, conflict, and incident-isolation tests before enabling builder previews.

`createBlockRegistry` is usable infrastructure for module discovery. `createBlockStub`, every core block renderer, the layout engine, data port, and board renderer are explicit `TODO(implementation)` boundaries.
