// ArgusOS realtime load contract. This file is deliberately non-executable:
// running it fails until authenticated fixtures and protocol instrumentation are
// implemented. `k6 inspect` validates syntax without opening connections.
export const options = {
  scenarios: {
    two_thousand_live_users: {
      executor: "constant-vus",
      exec: "realtimeCatchUp",
      vus: 2000,
      duration: "10m",
      gracefulStop: "30s",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    argus_commit_visible_ms: ["p(95)<250", "p(99)<1000"],
    argus_reconnect_catchup_ms: ["p(95)<3000", "max<3000"],
    argus_alert_delivery_ms: ["p(95)<2000", "max<2000"],
    argus_unauthorized_events: ["count==0"],
    argus_missed_commits: ["count==0"],
    argus_out_of_order_commits: ["count==0"],
  },
};

/**
 * Execute the authenticated 2,000-connection realtime scenario after implementation.
 * Input: ARGUS_REALTIME_WS_URL plus short-lived test credentials and deterministic
 * tenant/incident fixture identifiers supplied through the k6 environment.
 * Output: per-run metrics for connection, commit visibility, reconnect catch-up,
 * alert delivery, missed/order-violating commits, and authorization failures.
 * Errors: this stub always throws; it performs no network operations.
 * Depends on: k6 WebSocket support, isolated synthetic tenants, server commit IDs,
 * WAL cursors, render acknowledgements, and OTel-compatible load-run correlation.
 * Security: never use production users/data, log tokens/record payloads, or attach
 * high-cardinality user/record tags. Authorization fixtures must include two
 * tenants, two incidents, distinct positions, and revoked-access cases.
 */
export function realtimeCatchUp() {
  throw new Error(
    "TODO(implementation): execute authenticated realtime load and reconnect assertions",
  );
}

/**
 * Preserve the conventional k6 default entry point as an explicit stub.
 * Input: none.
 * Output: none.
 * Errors: always throws the same implementation TODO as the named scenario.
 * Depends on: realtimeCatchUp and all of its documented prerequisites.
 */
export default function realtimeLoad() {
  throw new Error(
    "TODO(implementation): execute authenticated realtime load and reconnect assertions",
  );
}

// Implementation requirements:
// - Hold 2,000 concurrent authenticated WebSocket connections for at least 10 min;
//   separately scale to 10,000+ across gateways rather than hiding gateway count.
// - Generate committed changes with server commit IDs/timestamps and assert every
//   subscriber renders each authorized change exactly once and in commit order.
// - Drop and restore at least 5% of connections each minute, including during
//   bursts; complete catch-up in <3 s with no missed change or silent resubscribe.
// - Measure alert raised-to-delivered latency (<2 s), commit visibility p95/p99,
//   CPU/memory, reconnect storms, JetStream lag, and Postgres replication lag.
// - Repeat with gateway, ElectricSQL, and NATS termination; never count reconnected
//   sockets alone as proof of durability or tenant/incident isolation.
