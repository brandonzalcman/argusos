import { z } from "zod";
import { alertInstanceSchema } from "./alert.js";
import { idSchema, type Timestamp, timestampSchema } from "./primitives.js";

/** Opaque WAL/JetStream cursor encoded as a string to avoid lossy 64-bit positions in JavaScript. */
export const realtimeCursorSchema = z.string().min(1).max(500);
export type RealtimeCursor = z.infer<typeof realtimeCursorSchema>;

/** Server-attributed actor. System events use null user/position IDs and a non-null service identity. */
export const realtimeActorSchema = z.strictObject({
  userId: idSchema.nullable(),
  positionId: idSchema.nullable(),
  service: z.string().min(1).max(100).nullable(),
});
export type RealtimeActor = z.infer<typeof realtimeActorSchema>;

/** Common authenticated envelope. Consumers must verify tenant/incident scope before applying an event locally. */
export const realtimeEventBaseSchema = z.strictObject({
  protocolVersion: z.literal(1),
  eventId: idSchema,
  tenantId: idSchema,
  incidentId: idSchema.nullable(),
  cursor: realtimeCursorSchema,
  occurredAt: timestampSchema,
  committedAt: timestampSchema.nullable(),
  actor: realtimeActorSchema,
});

/**
 * Wraps a payload schema in the common realtime envelope.
 * Input: a Zod payload schema. Output: a strict envelope schema. Errors are reported by Zod parsing.
 * Depends on the realtime gateway to enforce scoped credentials and permission-filtered payloads.
 */
export function realtimeEventEnvelopeSchema<TPayload extends z.ZodType>(payload: TPayload) {
  return realtimeEventBaseSchema.extend({ payload });
}

/** Generic inferred envelope for adapters that do not use the closed gateway event union. */
export interface RealtimeEventEnvelope<TPayload> {
  protocolVersion: 1;
  eventId: string;
  tenantId: string;
  incidentId: string | null;
  cursor: RealtimeCursor;
  occurredAt: Timestamp;
  committedAt: Timestamp | null;
  actor: RealtimeActor;
  payload: TPayload;
}

/** Permission-filtered row mutation. `values` contains only changed fields readable by the subscriber. */
export const recordChangedPayloadSchema = z.strictObject({
  tableId: idSchema,
  recordId: idSchema,
  tableDefinitionVersion: z.number().int().positive(),
  recordVersion: z.number().int().positive(),
  operation: z.enum(["create", "update", "soft-delete", "restore"]),
  changedFieldIds: z.array(idSchema),
  values: z.record(z.string(), z.unknown()),
});
export type RecordChangedPayload = z.infer<typeof recordChangedPayloadSchema>;

export const presencePayloadSchema = z.strictObject({
  userId: idSchema,
  positionId: idSchema,
  status: z.enum(["online", "viewing", "editing", "offline"]),
  boardId: idSchema.nullable(),
  recordId: idSchema.nullable(),
  expiresAt: timestampSchema,
});
export type PresencePayload = z.infer<typeof presencePayloadSchema>;

export const workflowRunPayloadSchema = z.strictObject({
  workflowId: idSchema,
  workflowRunId: idSchema,
  status: z.enum(["queued", "running", "waiting", "retrying", "succeeded", "failed", "cancelled"]),
});
export type WorkflowRunPayload = z.infer<typeof workflowRunPayloadSchema>;

/** Discriminated gateway event union. No event kind is allowed to broaden a subscriber's authorization. */
export const realtimeEventSchema = z.discriminatedUnion("type", [
  realtimeEventBaseSchema.extend({
    type: z.literal("record-changed"),
    payload: recordChangedPayloadSchema,
  }),
  realtimeEventBaseSchema.extend({
    type: z.literal("alert-changed"),
    payload: alertInstanceSchema,
  }),
  realtimeEventBaseSchema.extend({
    type: z.literal("presence-changed"),
    payload: presencePayloadSchema,
  }),
  realtimeEventBaseSchema.extend({
    type: z.literal("workflow-run-changed"),
    payload: workflowRunPayloadSchema,
  }),
  realtimeEventBaseSchema.extend({
    type: z.literal("definition-published"),
    payload: z.strictObject({
      definitionKind: z.string().min(1).max(100),
      definitionId: idSchema,
      version: z.number().int().positive(),
    }),
  }),
  realtimeEventBaseSchema.extend({
    type: z.literal("heartbeat"),
    payload: z.strictObject({ serverTime: timestampSchema }),
  }),
]);
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

/** Catch-up request. The gateway derives tenant/user/position from credentials and rejects broadened scopes. */
export const realtimeSubscriptionSchema = z.strictObject({
  subscriptionId: idSchema,
  tenantId: idSchema,
  incidentId: idSchema.nullable(),
  tableId: idSchema.nullable(),
  boardId: idSchema.nullable(),
  afterCursor: realtimeCursorSchema.nullable(),
});
export type RealtimeSubscription = z.infer<typeof realtimeSubscriptionSchema>;
