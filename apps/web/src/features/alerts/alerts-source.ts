import type { AlertChannel, AlertInstance, AlertRecipient } from "@argus/schema";
import type { AppScope } from "../../services/contracts.js";
import type { AlertDeliveryRecord, DeliveryStatus } from "./alert-delivery-record.js";

export type { DeliveryStatus };

/**
 * Display row: a delivery record joined with its alert and title for the status table.
 * Kept to the fields the UI reads so adapters need not supply attempt counters yet.
 */
export interface AlertDeliveryRow
  extends Pick<AlertDeliveryRecord, "id" | "channel" | "status" | "updatedAt" | "failureReason"> {
  readonly alert: AlertInstance;
  readonly title: string;
}

/** A pickable recipient group; individuals are intentionally not listed (privacy). */
export interface RecipientOption {
  readonly kind: "position" | "contact-group";
  readonly id: string;
  readonly name: string;
  /** Null when the directory cannot disclose the size to this caller. */
  readonly memberCount: number | null;
}

export interface AlertComposeRequest {
  readonly title: string;
  readonly message: string;
  readonly severity: AlertInstance["severity"];
  readonly channels: readonly AlertChannel[];
  readonly recipients: readonly AlertRecipient[];
  readonly acknowledgementRequired: boolean;
}

export interface AlertsSource {
  readonly listDeliveries: (scope: AppScope) => Promise<readonly AlertDeliveryRow[]>;
  readonly send: (scope: AppScope, request: AlertComposeRequest) => Promise<void>;
  readonly acknowledge: (scope: AppScope, alertId: string) => Promise<void>;
  /** Optional until adapters implement it; the picker reports "not connected" when absent. */
  readonly listRecipients?: (scope: AppScope) => Promise<readonly RecipientOption[]>;
}

/**
 * TODO(implementation): list deliveries, recipients, send alerts and record acknowledgements.
 * Input: AppScope plus compose request or alert id; recipient ids are validated server-side.
 * Output: scoped delivery rows and recipient options; send/acknowledge resolve once recorded.
 * Errors: rejects when unauthorized, out of scope, already acknowledged or a channel is disabled.
 * Depends on: packages/alerts adapters, Graphile Worker delivery jobs, WebSocket alert fan-out.
 */
export const alertsSourceStub: AlertsSource = {
  listDeliveries: () =>
    Promise.reject(new Error("TODO(implementation): AlertsSource.listDeliveries")),
  send: () => Promise.reject(new Error("TODO(implementation): AlertsSource.send")),
  acknowledge: () => Promise.reject(new Error("TODO(implementation): AlertsSource.acknowledge")),
  listRecipients: () =>
    Promise.reject(new Error("TODO(implementation): AlertsSource.listRecipients")),
};
