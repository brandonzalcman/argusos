# @argus/schema

Shared strict Zod contracts for ArgusOS metadata, security context, records, audit, realtime and API transport. This package contains no database, network, React or service infrastructure. All schemas use explicit objects and inferred TypeScript types; runtime authorization and CEL compilation remain in their owning packages.

## Implementation order

1. Validate `OperationContext` at the authenticated API boundary, then use the same tenant/position/incident context for RLS, audit and realtime subscriptions.
2. Implement definition persistence and optimistic draft/publish transitions around `DefinitionMetadata`; keep published revisions immutable.
3. Validate table, field and relation definitions before passing them to the DDL engine. Allocate physical identifiers outside this package and bind all values as SQL parameters.
4. Add saved views, boards, blocks and responsive layouts, enforcing position and field permissions in every runtime projection.
5. Add workflows, alerts and maps behind their durable execution/adaptor packages.
6. Add theme/menu/homepage contracts to position runtime, then pack import/export and sandboxed plugins.
7. Consume record, audit, realtime and API result envelopes in vertical slices. Add the todo tests as executable conformance tests alongside each implementation.

The twelve Phase 1 field IDs are listed in `coreFieldTypeIds`; all remaining plan section 5.3 IDs are explicitly marked as later in `laterFieldTypeIds`.
