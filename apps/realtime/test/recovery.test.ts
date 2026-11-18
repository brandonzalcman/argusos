import { describe, it } from "vitest";

describe("realtime recovery and presence", () => {
  it.todo("backfills from durable cursors in order and de-duplicates overlap with live events");
  it.todo("uses current RLS/FLS during replay so revoked records and fields are never disclosed");
  it.todo("falls back to explicit five-second polling with a visible stale/offline indicator");
  it.todo("expires presence and soft editing locks without blocking incident writes");
  it.todo("measures commit-to-visible, alert-delivery, and reconnect latency with safe labels");
  it.todo("recovers 2,000 connections without event loss during gateway and NATS failure tests");
});
