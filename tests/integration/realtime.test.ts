import { describe, it } from "vitest";

describe("durable realtime recovery", () => {
  it.todo(
    "resumes from the last acknowledged WAL cursor with no missed or reordered committed changes",
  );
  it.todo("deduplicates replayed NATS messages using durable consumers and idempotency keys");
  it.todo(
    "recovers after gateway, ElectricSQL, and NATS process termination without silently losing alerts",
  );
  it.todo("maintains commit order per tenant and incident during bursts and reconnects");
  it.todo("does not publish unauthorized rows while permissions or subscriptions are changing");
  it.todo(
    "emits commit timestamp and render acknowledgement telemetry without sensitive record payloads",
  );
});
