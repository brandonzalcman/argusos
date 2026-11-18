import { describe, it } from "vitest";

describe("alert channel adapters", () => {
  it.todo("registers each enabled channel once and rejects duplicate or implicit adapters");
  it.todo("uses stable tenant/incident/delivery idempotency keys across provider retries");
  it.todo("classifies retryable, permanent, accepted, and suppressed outcomes consistently");
  it.todo("redacts credentials, recipient destinations, provider URLs, tokens, and message bodies");
  it.todo("enforces recipient and destination policy for SMS, voice, Teams, Slack, and webhooks");
  it.todo("blocks webhook SSRF through redirects, DNS changes, and local or link-local addresses");
  it.todo("persists in-app deliveries with RLS and leaves realtime fan-out to the gateway");
  it.todo("handles SMTP TLS, provider timeouts, rate limits, and air-gapped adapter configuration");
});

describe("CAP 1.2", () => {
  it.todo("round-trips namespace-safe CAP XML against validated fixtures");
  it.todo("escapes alert content without string interpolation into XML");
  it.todo("maps exercise incidents to Exercise status and preserves restricted-scope policy");
  it.todo("supports optional digital signatures without exposing signing keys");
});
