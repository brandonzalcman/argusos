import { z } from "zod";
import { celExpressionSchema, idSchema, timestampSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

export const alertChannelSchema = z.enum([
  "email",
  "sms",
  "voice",
  "push",
  "in-app",
  "teams",
  "slack",
  "webhook",
]);
export type AlertChannel = z.infer<typeof alertChannelSchema>;

/** Recipient selector resolved under the triggering tenant; external addresses require channel-specific consent checks. */
export const alertRecipientSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("user"), userId: idSchema }),
  z.strictObject({ type: z.literal("position"), positionId: idSchema }),
  z.strictObject({ type: z.literal("contact-group"), groupId: idSchema }),
  z.strictObject({ type: z.literal("expression"), expression: celExpressionSchema }),
]);
export type AlertRecipient = z.infer<typeof alertRecipientSchema>;

/** Versioned alert rule. Channel adapters and durable delivery behavior are implemented outside this package. */
export const alertDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  name: z.string().min(1).max(200),
  severity: z.enum(["info", "minor", "major", "critical"]),
  incidentScope: z.enum(["incident", "global", "all"]),
  triggerExpression: celExpressionSchema,
  titleTemplate: z.string().min(1).max(500),
  messageTemplate: z.string().min(1).max(10_000),
  recipients: z.array(alertRecipientSchema).min(1),
  channels: z.array(alertChannelSchema).min(1),
  acknowledgementRequired: z.boolean(),
  acknowledgementDeadlineSeconds: z.number().int().positive().nullable(),
  escalationPositionIds: z.array(idSchema),
  deduplicationExpression: celExpressionSchema.nullable(),
});
export type AlertDefinition = z.infer<typeof alertDefinitionSchema>;

/** Delivery-independent alert instance used by in-app inbox, acknowledgement APIs and realtime fan-out. */
export const alertInstanceSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  incidentId: idSchema.nullable(),
  definitionId: idSchema,
  definitionVersion: z.number().int().positive(),
  severity: z.enum(["info", "minor", "major", "critical"]),
  status: z.enum([
    "pending",
    "delivering",
    "delivered",
    "acknowledged",
    "escalated",
    "cancelled",
    "failed",
  ]),
  raisedAt: timestampSchema,
  acknowledgedAt: timestampSchema.nullable(),
  acknowledgedBy: idSchema.nullable(),
  acknowledgedPositionId: idSchema.nullable(),
});
export type AlertInstance = z.infer<typeof alertInstanceSchema>;
