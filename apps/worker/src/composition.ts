import type { AlertAdapterRegistry } from "@argus/alerts";
import type { Runner } from "graphile-worker";
import type { WorkerConfig } from "./config/env.js";

export interface WorkerComposition {
  readonly config: WorkerConfig;
  readonly alertAdapters: AlertAdapterRegistry;
}

/**
 * TODO(implementation): compose and run Graphile Worker with all durable job handlers and graceful stop.
 * Input: validated worker configuration and explicitly enabled alert adapter registry.
 * Output: a started Graphile Runner whose promise follows worker shutdown and resource cleanup.
 * Errors: throws redacted startup errors and stops partially initialized database/NATS/storage clients.
 * Depends on: Graphile Worker migrations, scoped repositories, task registry, NATS, S3, and telemetry.
 * Security: uses least-privilege credentials and establishes tenant/incident/RLS/audit context inside jobs.
 */
export function createGraphileWorker(_dependencies: WorkerComposition): Promise<Runner> {
  throw new Error("TODO(implementation): createGraphileWorker");
}

/**
 * TODO(implementation): validate environment, build adapters/ports, start the runner, and handle signals.
 * Input: raw process environment supplied by main or a test harness.
 * Output: resolves after graceful completion of in-flight jobs and dependency cleanup.
 * Errors: throws safe startup/shutdown errors without logging queue payloads or secrets.
 * Depends on: parseWorkerEnvironment, alert adapters, createWorkerJobHandlers, and createGraphileWorker.
 * Security: no ambient cross-tenant credentials are exposed to workflow steps or server plugin actions.
 */
export function startWorker(
  _environment: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  throw new Error("TODO(implementation): startWorker");
}
