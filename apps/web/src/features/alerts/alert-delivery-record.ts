import { alertChannelSchema } from "@argus/schema";
import { z } from "zod";

/**
 * TODO(decision): PROPOSAL for a per-channel delivery record. @argus/schema defines AlertInstance
 * (one row per alert) but nothing for the attempt of each alert on each channel. If accepted this
 * file moves to packages/schema/src/alert.ts unchanged and this feature imports it from there.
 *
 * Proposed invariants:
 * - one record per (alertInstanceId, channel); retries increment `attemptCount`, never add rows;
 * - `status` is monotonic queued -> sent -> delivered, or any -> failed; `failureReason` is set
 *   only when failed and contains no recipient addresses or payload text (safe to display);
 * - tenantId/incidentId mirror the alert instance so RLS and Electric shapes filter the same way.
 */
export const alertDeliveryStatusSchema = z.enum(["queued", "sent", "delivered", "failed"]);
export type DeliveryStatus = z.infer<typeof alertDeliveryStatusSchema>;

export const alertDeliveryRecordSchema = z.strictObject({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  incidentId: z.string().min(1).nullable(),
  alertInstanceId: z.string().min(1),
  channel: alertChannelSchema,
  status: alertDeliveryStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  failureReason: z.string().max(500).nullable(),
});
export type AlertDeliveryRecord = z.infer<typeof alertDeliveryRecordSchema>;
