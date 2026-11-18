# {{pluginDisplayName}}

Default ArgusOS server-plugin template. This is a typed scaffold, not a running integration or local development server.

1. Replace the activation stub with one narrow integration behavior.
2. Request only required capabilities and exact egress origins in `argus.plugin.json`.
3. Keep tenant, incident, actor, field, and audit scope in host API calls; never accept ownership from payloads.
4. Add tests for malformed input, capability denial, revocation, retries, dedupe, and resource cleanup.
5. Use the ArgusOS plugin runtime/local dev server after those host facilities are implemented.

Dependency versions use the host workspace catalog. When generating outside that workspace, the CLI must write an appropriate standalone catalog/lockfile policy; this template does not install dependencies.
