import { z } from "zod";
import { celExpressionSchema, idSchema, jsonValueSchema, timestampSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/** Event or schedule that starts a workflow; durable subscriptions must retain tenant and incident scope. */
export const workflowTriggerSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("record-created"), tableId: idSchema }),
  z.strictObject({
    type: z.literal("record-updated"),
    tableId: idSchema,
    fieldIds: z.array(idSchema),
  }),
  z.strictObject({
    type: z.literal("schedule"),
    cron: z.string().min(1).max(200),
    timeZone: z.string().min(1).max(100),
  }),
  z.strictObject({ type: z.literal("incident-activated") }),
  z.strictObject({ type: z.literal("incident-escalated") }),
  z.strictObject({ type: z.literal("inbound-webhook"), endpointKey: z.string().min(1).max(100) }),
  z.strictObject({ type: z.literal("form-submitted"), viewId: idSchema }),
  z.strictObject({ type: z.literal("button-clicked"), boardId: idSchema, blockId: idSchema }),
]);
export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;

export const workflowRetryPolicySchema = z.strictObject({
  maximumAttempts: z.number().int().min(1).max(100),
  backoffSeconds: z.number().int().nonnegative().max(86_400),
});
export type WorkflowRetryPolicy = z.infer<typeof workflowRetryPolicySchema>;

const workflowStepBaseSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1).max(200),
  retry: workflowRetryPolicySchema,
});

/** Automation step definitions. Runtime adapters validate scoped credentials again at execution time. */
export const workflowStepSchema = z.discriminatedUnion("type", [
  workflowStepBaseSchema.extend({ type: z.literal("condition"), expression: celExpressionSchema }),
  workflowStepBaseSchema.extend({
    type: z.literal("create-record"),
    tableId: idSchema,
    valuesExpression: celExpressionSchema,
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("update-record"),
    tableId: idSchema,
    recordIdExpression: celExpressionSchema,
    valuesExpression: celExpressionSchema,
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("assign-to-position"),
    positionIdExpression: celExpressionSchema,
    recordIdExpression: celExpressionSchema,
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("send-alert"),
    alertDefinitionId: idSchema,
    inputExpression: celExpressionSchema.nullable(),
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("call-webhook"),
    url: z.string().url().max(2_048),
    method: z.enum(["POST", "PUT", "PATCH"]),
    bodyExpression: celExpressionSchema.nullable(),
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("wait"),
    durationSeconds: z.number().int().positive().max(31_536_000),
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("approval"),
    approverPositionIds: z.array(idSchema).min(1),
    instructions: z.string().max(5_000),
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("escalate"),
    deadlineExpression: celExpressionSchema,
    targetPositionIds: z.array(idSchema).min(1),
  }),
  workflowStepBaseSchema.extend({
    type: z.literal("plugin-action"),
    pluginId: idSchema,
    actionKey: z.string().min(1).max(100),
    inputExpression: celExpressionSchema.nullable(),
  }),
]);
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

/** Directed edge between steps; cycle and reachability validation belongs to the workflow compiler. */
export const workflowEdgeSchema = z.strictObject({
  id: idSchema,
  sourceStepId: idSchema,
  targetStepId: idSchema,
  branch: z.enum(["next", "true", "false", "approved", "rejected", "failed"]),
});
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

/** Versioned durable workflow. Publishing requires trigger permission, step permission and sandbox capability checks. */
export const workflowDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable(),
  enabled: z.boolean(),
  incidentScope: z.enum(["incident", "global", "all"]),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema),
  edges: z.array(workflowEdgeSchema),
  runPositionIds: z.array(idSchema),
});
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

/** Durable run projection used by audit/history APIs; payloads must be redacted for field-level permissions. */
export const workflowRunSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  incidentId: idSchema.nullable(),
  workflowId: idSchema,
  workflowVersion: z.number().int().positive(),
  status: z.enum(["queued", "running", "waiting", "retrying", "succeeded", "failed", "cancelled"]),
  startedBy: idSchema.nullable(),
  startedPositionId: idSchema.nullable(),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  context: z.record(z.string(), jsonValueSchema),
});
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
