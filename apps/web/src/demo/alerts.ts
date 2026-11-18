import type { AlertChannel, AlertInstance } from "@argus/schema";
import type {
  AlertDeliveryRow,
  AlertsSource,
  DeliveryStatus,
} from "../features/alerts/alerts-source.js";
import {
  DEMO_ACTOR,
  DEMO_INCIDENTS,
  DEMO_POSITIONS,
  DEMO_TENANT_ID,
  DEMO_USERS,
  demoDelay,
  demoId,
  minutesAgo,
} from "./scenario.js";
import { notifyDemoChange } from "./services.js";

const TABLE = "alert_deliveries";

interface DemoDelivery {
  id: string;
  channel: AlertChannel;
  status: DeliveryStatus;
  updatedAt: string;
  failureReason: string | null;
}

interface DemoAlert {
  alert: AlertInstance;
  title: string;
  deliveries: DemoDelivery[];
}

type ChannelSpec = readonly [AlertChannel, DeliveryStatus, string?];

function makeAlert(
  title: string,
  severity: AlertInstance["severity"],
  status: AlertInstance["status"],
  raisedMinutesAgo: number,
  channels: readonly ChannelSpec[],
  ackMinutesAgo?: number,
): DemoAlert {
  const acked = ackMinutesAgo !== undefined;
  return {
    title,
    alert: {
      id: demoId(),
      tenantId: DEMO_TENANT_ID,
      incidentId: DEMO_INCIDENTS.harlowFlood,
      definitionId: demoId(),
      definitionVersion: 1,
      severity,
      status,
      raisedAt: minutesAgo(raisedMinutesAgo),
      acknowledgedAt: acked ? minutesAgo(ackMinutesAgo) : null,
      acknowledgedBy: acked ? DEMO_USERS.priyaShah : null,
      acknowledgedPositionId: acked ? DEMO_POSITIONS.operationsChief : null,
    },
    deliveries: channels.map(([channel, deliveryStatus, failureReason], index) => ({
      id: demoId(),
      channel,
      status: deliveryStatus,
      updatedAt: minutesAgo(Math.max(0, raisedMinutesAgo - index)),
      failureReason: failureReason ?? null,
    })),
  };
}

/** Most recent first. All content is fictional. */
const alerts: DemoAlert[] = [
  makeAlert("Boil-water advisory: Millbrook district", "critical", "delivering", 6, [
    ["sms", "queued"],
    ["email", "failed", "Mailbox full for 14 recipients (demo)"],
    ["push", "sent"],
  ]),
  makeAlert("Evacuation order: Riverside Terrace", "critical", "delivering", 28, [
    ["sms", "delivered"],
    ["voice", "failed", "Recipient phone unreachable after 3 attempts (demo)"],
    ["email", "sent"],
  ]),
  makeAlert("Eastfield School shelter at 90% capacity", "major", "delivered", 55, [
    ["teams", "delivered"],
    ["in-app", "delivered"],
    ["email", "delivered"],
  ]),
  makeAlert(
    "River gauge above flood stage at Harlow Bridge",
    "major",
    "acknowledged",
    130,
    [
      ["in-app", "delivered"],
      ["slack", "delivered"],
    ],
    118,
  ),
  makeAlert(
    "Road closure: Mill Street bridge",
    "minor",
    "acknowledged",
    210,
    [
      ["push", "delivered"],
      ["sms", "delivered"],
    ],
    200,
  ),
  makeAlert(
    "Situation report OP 3 published",
    "info",
    "acknowledged",
    420,
    [
      ["email", "delivered"],
      ["webhook", "delivered"],
    ],
    400,
  ),
];

function toRows(): AlertDeliveryRow[] {
  return alerts.flatMap((entry) =>
    entry.deliveries.map((delivery) => ({
      id: delivery.id,
      alert: entry.alert,
      title: entry.title,
      channel: delivery.channel,
      status: delivery.status,
      updatedAt: delivery.updatedAt,
      failureReason: delivery.failureReason,
    })),
  );
}

/** Moves a delivery to a new status after a delay, as a worker would. */
function progress(
  entry: DemoAlert,
  delivery: DemoDelivery,
  status: DeliveryStatus,
  ms: number,
): void {
  setTimeout(() => {
    delivery.status = status;
    delivery.updatedAt = minutesAgo(0);
    if (
      entry.alert.status === "delivering" &&
      entry.deliveries.every((candidate) => candidate.status === "delivered")
    ) {
      entry.alert = { ...entry.alert, status: "delivered" };
    }
    notifyDemoChange(TABLE);
  }, ms);
}

/** In-memory alert deliveries for demo mode; state resets on page reload. */
export const demoAlertsSource: AlertsSource = {
  listDeliveries: () => demoDelay(toRows(), 200),
  send: async (scope, request) => {
    await demoDelay(undefined, 300);
    const entry: DemoAlert = {
      title: request.title,
      alert: {
        id: demoId(),
        tenantId: scope.tenantId,
        incidentId: scope.incidentId,
        definitionId: demoId(),
        definitionVersion: 1,
        severity: request.severity,
        status: "delivering",
        raisedAt: minutesAgo(0),
        acknowledgedAt: null,
        acknowledgedBy: null,
        acknowledgedPositionId: null,
      },
      deliveries: request.channels.map((channel) => ({
        id: demoId(),
        channel,
        status: "queued" as DeliveryStatus,
        updatedAt: minutesAgo(0),
        failureReason: null,
      })),
    };
    alerts.unshift(entry);
    entry.deliveries.forEach((delivery, index) => {
      progress(entry, delivery, "sent", 1200 + index * 500);
      progress(entry, delivery, "delivered", 3200 + index * 700);
    });
    notifyDemoChange(TABLE);
  },
  acknowledge: async (_scope, alertId) => {
    await demoDelay(undefined, 200);
    const entry = alerts.find((candidate) => candidate.alert.id === alertId);
    if (entry === undefined) throw new Error("Demo alert not found.");
    entry.alert = {
      ...entry.alert,
      status: "acknowledged",
      acknowledgedAt: minutesAgo(0),
      acknowledgedBy: DEMO_ACTOR.userId,
      acknowledgedPositionId: DEMO_ACTOR.positionId,
    };
    notifyDemoChange(TABLE);
  },
};
