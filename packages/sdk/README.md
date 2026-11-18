# @argus/sdk

Typed contracts for sandboxed iframe clients, the host bridge, scoped server plugins, lifecycle/capabilities, the `create-argus-plugin` CLI template, and the **custom component sandbox** (TSX written in the browser, run only inside a sandboxed iframe). Server plugin lifecycle and the CLI are still throwing stubs.

## Entry points

| Import | Runs in | Contents |
| --- | --- | --- |
| `@argus/sdk` | anywhere | protocol types and parsers, capability enforcement, compiler, block templates, bridge/client |
| `@argus/sdk/host` | app origin (React) | `SandboxFrame`, `createHostBridge`, `resolveThemeTokens` |
| `@argus/sdk/sandbox-runtime` | sandboxed iframe | `startSandboxRuntime()`; used by `apps/web/sandbox/main.ts` |
| `@argus/sdk/compiler` | anywhere | `compileComponent`, import allowlist |
| `@argus/sdk/templates` | anywhere | `getBlockTemplate(blockType)`, `blankComponentTemplate` |
| `@argus/sdk/client` | iframe | `createIframeClient` |

## Custom component sandbox

1. The host renders `<SandboxFrame source props componentKey version capabilities services title />`. It creates `<iframe sandbox="allow-scripts" src="/sandbox/component.html">` (override with `sandboxUrl`).
2. The iframe document (`apps/web/sandbox/component.html`) has a strict CSP and runs the runtime. It posts `sandbox.boot`; the host answers with `sandbox.load` (source, props, resolved `--argus-*` theme tokens, density, session id, nonce).
3. The runtime compiles the TSX with sucrase (typescript + jsx + imports), runs it with `new Function` **inside the iframe only**, and renders the default export with React 19 inside an error boundary. Imports are limited to `react` and `@argus/component-sdk`.
4. `@argus/component-sdk` (virtual module) provides `useProps`, `useTheme`, `useRecords`, `useRecord`, `updateRecord` and `Stack`, `Text`, `Heading`, `Card`, `Button`, `Badge`, `EmptyState`. Data hooks return `{ status, loading, error, data }` and surface host errors such as `capability-denied` or `version-conflict`.
5. The runtime reports `ready`, `render-error` (phase, line, column), capped `console`, `resize` and a 1 s heartbeat. `SandboxFrame` turns them into `onEvent` callbacks (`ready`, `error`, `console`, `resize`, `stalled`, `navigated`).

Record requests use the existing `record.get` / `record.update` / `record.subscribe` protocol messages through `createHostBridge`, which enforces capabilities and redacts fields before calling the host-provided `HostBridgeServices`.

Component capabilities (`@argus/schema` `PluginCapability`) map to bridge grants: `read-records` to `record:read`, `update-records` to `record:update`, `subscribe-records` to `record:subscribe`. `outbound-http` and `workflow-action` are ignored (no network, no workflow bridge). Empty `tableIds` or `fieldIds` grant nothing (TODO(decision): whether empty should mean "any table chosen at placement"). Subscriptions also require `record:read`.

Hosting requirements for the sandbox page:

- Because the frame has an opaque origin, its module scripts are fetched cross-origin from origin `null`. Dev (`server.cors`) allows it; production must serve the sandbox page and its `/assets/*` with `Access-Control-Allow-Origin: *` (public code, no secrets) and should also send the page's CSP as a **response header** plus `frame-ancestors 'self'`, which a `<meta>` CSP cannot express.
- Vite dev strips the HMR client from the sandbox page only; it needs no relaxation of the CSP.

## Security model

Threat: component source is untrusted, authored by users with `editCode`, and may be hostile.

- **No eval in the app origin.** Source is only ever compiled and executed in the iframe. The CSP of that document needs `script-src 'unsafe-eval'` for `new Function`; this is acceptable only because the document is opaque-origin, has no storage, no network and no secrets.
- **Opaque origin.** `sandbox="allow-scripts"` only: never `allow-same-origin`, no top navigation, popups, forms, modals or downloads. `localStorage`, cookies and `window.parent.document` are blocked (verified in a real browser, see below).
- **CSP** (`default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`): no network, no nested frames, no remote images.
- **Capability-gated bridge.** Every request is parsed strictly, matched to the host-issued session id and installation, deduplicated by message id, rate limited, then checked against host-derived grants (table, field, incident, expiry). A restricted dimension omitted from the request is denied, never widened. Message claims about tenant or actor are ignored; the scope is built by the host.
- **Host-side field redaction.** Requested fields are narrowed to granted fields before the service call, returned and subscribed records are filtered again, and updates touching an ungranted field are rejected. Hidden fields never cross the bridge.
- **Message validation.** `SandboxFrame` accepts only events whose `source` is its own iframe `contentWindow` and `origin === "null"`, parses with strict bounded parsers (size, depth, plain-JSON only, unknown kinds rejected, errors never echo payloads), and ignores everything else. The in-frame runtime accepts only its parent window and pins the first embedder's origin (trust on first use; the page holds no secrets).
- **Safe errors.** Service error text is never forwarded; errors map to fixed codes and messages.
- **Allowlisted imports.** Only `react` and `@argus/component-sdk` can be imported; `fs`, relative paths, URLs and `react/jsx-runtime` fail with a clear message and line. Unused imports are kept by the compiler so they cannot be hidden. The allowlist is a guard, not the boundary: the iframe is.
- **Host traffic hidden from user code.** The runtime registers its message listener first (capture phase) and stops propagation, so user-registered `message` listeners cannot read session ids or nonces; the client receives traffic through a private shim.
- **Postmessage target.** An opaque origin cannot be targeted exactly, so host-to-frame messages use `"*"` with the exact `contentWindow`. Data is only sent in response to validated, capability-checked requests, and the frame is torn down if it ever fires a second `load` (navigation).
- **Frozen frame watchdog.** The runtime posts a heartbeat every second; `SandboxFrame` removes the iframe when none arrives for `heartbeatTimeoutMs` (default 5 s) and emits `stalled`. A hostile `while(true)` was stopped this way in Edge. Caveat: a sandboxed iframe without `allow-same-origin` is usually, but not guaranteed to be, in its own process (site isolation / origin-keyed agent clusters are browser dependent); in a browser that shares the event loop, a busy loop can still freeze the host UI until the watchdog fires, and the watchdog itself cannot run while the host thread is blocked. Mitigations to add: serve the sandbox from a separate site (for example a sandbox subdomain) so site isolation applies, and send `Origin-Agent-Cluster`.

## Verification

Run in a real browser (Edge via Playwright against `vite dev` and the dev-only `apps/web/sandbox/harness.html`): render with props and theme tokens (live theme changes), compile errors with line/column, disallowed import errors, render errors with mapped line, `capability-denied` surfaced by `useRecords`, hidden field not returned, CSP blocking `fetch`, `localStorage` and parent DOM access blocked, and the watchdog removing a frame stuck in an infinite loop.

## Still TODO

- Resource limits beyond the watchdog: memory/DOM size caps, per-component CPU budget, render timeouts, and `Worker`-based execution if component code that needs no DOM is introduced.
- Serve the sandbox from a separate site and send CSP, `frame-ancestors` and CORS headers in `deploy/` and the API (TODO(implementation): devops).
- Authorization revision push: revoke grants mid-session (`it.todo` in `test/bridge.test.ts`); incident membership checks in API services.
- Initial snapshot semantics of `record.subscribe` (the hook assumes the host emits current records as `record.changed`), a list/query message, and bridges for files, comments and workflows.
- Source maps for runtime error lines (currently best effort from V8 stacks).
- Editor typings for `@argus/component-sdk` (ambient declarations for the code editor).
- DOM tests (jsdom or Playwright) listed as `it.todo` in `test/compile.test.ts`.
- Server plugin lifecycle in an isolated worker, scoped tokens, egress policy; `create-argus-plugin` CLI.

## Implementation order for the remaining plugin work

1. Define versioned manifests and least-privilege capabilities. Capabilities must be declared, granted by an administrator, and limited to one tenant, permitted incidents, records, fields, actions, and network destinations.
2. Extend the iframe handshake with manifest hashes and replay protection beyond message-id uniqueness.
3. Re-check tenant, incident, position, RLS/FLS, optimistic record versions, and audit attribution in the API services behind `HostBridgeServices`; iframe isolation is not an authorization boundary.
4. Implement server plugin lifecycle in an isolated worker with scoped tokens, resource/time limits, explicit egress policy, structured audit events, and no ambient host credentials.
5. Implement `create-argus-plugin` by copying and validating the default template, then add sandbox escape, cross-origin, confused-deputy, capability denial, revocation, and version-conflict tests.
