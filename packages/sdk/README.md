# @argus/sdk

Typed contracts for sandboxed iframe clients, the host bridge, scoped server plugins, lifecycle/capabilities, and the `create-argus-plugin` CLI template. The bridge, runtime, message validation, and CLI are throwing stubs; no plugin is executed.

## Implementation order

1. Define versioned manifests and least-privilege capabilities. Capabilities must be declared, granted by an administrator, and limited to one tenant, permitted incidents, records, fields, actions, and network destinations.
2. Implement strict runtime message schemas and the iframe handshake. Validate `origin`, `source`, plugin installation, protocol version, correlation IDs, payload sizes, and one-time nonces on every message; never use wildcard target origins.
3. Implement the host bridge against authorized API services. Re-check tenant, incident, position, RLS/FLS, optimistic record versions, and audit attribution for every request; iframe isolation is not an authorization boundary.
4. Implement client request correlation, subscription cleanup, abort/dispose behavior, and host navigation/logout teardown without leaking one plugin's messages to another.
5. Implement server plugin lifecycle in an isolated worker with scoped tokens, resource/time limits, explicit egress policy, structured audit events, and no ambient host credentials.
6. Implement `create-argus-plugin` by copying and validating the default template, then add sandbox escape, cross-origin, confused-deputy, capability denial, revocation, and version-conflict tests.

The default template documents the intended plugin shape and is not a runnable development server. No iframe sandbox can safely load untrusted plugins until the host threat model and CSP are implemented and reviewed.
