import type { AppScope } from "./contracts.js";

export interface PerformanceSpan {
  readonly end: (outcome: "ok" | "error" | "cancelled") => void;
}

export interface CommitVisibleMeasurement {
  readonly scope: AppScope;
  readonly subscriptionId: string;
  readonly walPosition: string;
  readonly committedAt: string;
  readonly visibleAt: string;
}

export interface PerformanceInstrumentationPort {
  readonly startSpan: (
    name: string,
    attributes: Readonly<Record<string, string | number | boolean>>,
  ) => PerformanceSpan;
  readonly reportCommitToVisible: (measurement: CommitVisibleMeasurement) => void;
  readonly reportInteraction: (name: string, durationMs: number) => void;
}

function instrumentationNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): PerformanceInstrumentationPort.${method}`);
}

/**
 * TODO(implementation): export redacted OpenTelemetry spans and realtime/render latency metrics.
 * Input: operation names, low-cardinality attributes, and commit-to-visible timestamps.
 * Output: a throwing port; future spans require explicit completion and metrics are fire-and-forget.
 * Errors: every method throws TODO(implementation); instrumentation must never block operations.
 * Depends on: OpenTelemetry web SDK, deployment collector, and performance budget dashboards.
 * Never attach record values, presence names, tokens, query text, or other sensitive data to spans.
 */
export function createPerformanceInstrumentationStub(): PerformanceInstrumentationPort {
  return {
    startSpan: () => instrumentationNotImplemented("startSpan"),
    reportCommitToVisible: () => instrumentationNotImplemented("reportCommitToVisible"),
    reportInteraction: () => instrumentationNotImplemented("reportInteraction"),
  };
}
