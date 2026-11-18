# @argus/alerts

Provider-neutral alert delivery contracts and channel adapter scaffolds for SMTP email, SMS, voice, Expo push, in-app inbox, Microsoft Teams, Slack, generic webhooks, and CAP 1.2. No provider request, inbox write, CAP serialization, credential lookup, or retry behavior is implemented.

## Implementation order

1. Implement immutable delivery requests, recipient redaction, secret references, idempotency keys, bounded timeouts, and a typed adapter registry.
2. Build in-app and SMTP adapters first, including durable attempt/audit records and safe provider error classification.
3. Add SMS, voice, Expo push, Teams, and Slack adapters behind the same contract. Keep provider SDKs and credentials in adapter infrastructure, not channel payloads.
4. Add generic webhooks with per-tenant signing keys, replay-resistant timestamps, egress allowlists, DNS/IP revalidation, redirect limits, and SSRF protection.
5. Add CAP 1.2 XML generation with namespace-safe serialization, standards validation, digital-signing hooks, and round-trip fixtures. Do not interpolate unescaped alert content into XML.
6. Verify duplicate suppression, acknowledgement/escalation semantics, tenant/incident isolation, rate limits, provider outages, redacted telemetry, and air-gapped provider alternatives.

Adapters report delivery attempts; they do not decide who should be alerted or bypass authorization. Orchestration and acknowledgement tracking belong to the worker/API services.
