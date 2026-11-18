# @argus/docs

Current Docusaurus documentation-site scaffold. Documentation is served from `docs/` at the site root (`routeBasePath: "/"`), and `docusaurus.config.ts` writes production output to `dist/` through the build script.

**Nothing described as planned or future behavior is implemented or verified.** The site URL uses the reserved `.invalid` domain until deployment ownership is decided. Repository directories such as `packages/schema/` are shown as inline code rather than hosted-site links. Docusaurus keeps broken-link warnings enabled so normal documentation links are validated during the build.

The package `type` is temporarily unset because Docusaurus 3.10.2's webpack SSG runtime fails under an explicit ESM package boundary (`require.resolveWeak is not a function`), while explicit `commonjs` makes generated client modules parse as `javascript/dynamic`. TypeScript configuration and source imports remain ESM syntax. `TODO(verify)`: retest and restore `"type": "module"` after an upstream Docusaurus fix; no product JavaScript executes as CommonJS.

## Contents

- Architecture and local development
- Metadata, draft/publish, optimistic versioning, security, RLS and audit
- Realtime/event flows
- Board, field-type, workflow and plugin implementation order
- Deployment constraints and roadmap
- Board-pack status under `packs/`

## Implementation order

1. Keep this site aligned with the product plan and package public contracts as foundations land.
2. Replace scaffold contract summaries with verified behavior only alongside implementation tests.
3. Document local Docker/auth/database commands after those workflows actually run.
4. Add versioning and migration guidance when the first published definitions exist.
5. Add production hostnames, screenshots and operational runbooks only during deployment implementation.
6. Keep broken-link warnings enabled and represent new repository-directory references as non-navigating inline code.

## Commands

With root dependencies installed through the pinned pnpm version:

- `pnpm --filter @argus/docs dev`
- `pnpm --filter @argus/docs build`
- `pnpm --filter @argus/docs typecheck`
- `pnpm --filter @argus/docs test`

Run build, typecheck and tests before reporting a docs change as verified. TODO-only tests describe intended coverage; they are not behavioral verification.
