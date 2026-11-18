import { z } from "zod";
import {
  celExpressionSchema,
  idSchema,
  jsonValueSchema,
  semanticVersionSchema,
} from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/** Explicit least-privilege capabilities requested by a plugin; grants are audited per tenant. */
export const pluginCapabilitySchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("read-records"),
    tableIds: z.array(idSchema),
    fieldIds: z.array(idSchema),
  }),
  z.strictObject({
    type: z.literal("update-records"),
    tableIds: z.array(idSchema),
    fieldIds: z.array(idSchema),
  }),
  z.strictObject({
    type: z.literal("subscribe-records"),
    tableIds: z.array(idSchema),
    fieldIds: z.array(idSchema),
  }),
  z.strictObject({
    type: z.literal("outbound-http"),
    allowedHosts: z.array(z.string().min(1).max(255)),
  }),
  z.strictObject({
    type: z.literal("workflow-action"),
    actionKeys: z.array(z.string().min(1).max(100)),
  }),
]);
export type PluginCapability = z.infer<typeof pluginCapabilitySchema>;

/** Sandboxed UI entrypoint declaration. Remote code is isolated in an iframe with a typed host message port. */
export const pluginClientEntrySchema = z.strictObject({
  kind: z.enum(["block", "field-type"]),
  key: z.string().min(1).max(100),
  entryPath: z.string().min(1).max(500),
});
export type PluginClientEntry = z.infer<typeof pluginClientEntrySchema>;

/** Worker entrypoint declaration; deployment and process isolation are owned by @argus/sdk and the worker app. */
export const pluginServerEntrySchema = z.strictObject({
  kind: z.literal("worker"),
  entryPath: z.string().min(1).max(500),
  timeoutSeconds: z.number().int().positive().max(3_600),
});
export type PluginServerEntry = z.infer<typeof pluginServerEntrySchema>;

/** Versioned installed plugin manifest. Secrets are referenced by opaque IDs and never appear in this definition. */
export const pluginDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  key: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,99}$/),
  name: z.string().min(1).max(200),
  pluginVersion: semanticVersionSchema,
  clientEntries: z.array(pluginClientEntrySchema),
  serverEntry: pluginServerEntrySchema.nullable(),
  capabilities: z.array(pluginCapabilitySchema),
  secretReferenceIds: z.array(idSchema),
  configuration: z.record(z.string(), jsonValueSchema),
  accessRule: celExpressionSchema.nullable(),
});
export type PluginDefinition = z.infer<typeof pluginDefinitionSchema>;

/** Correlation envelope for sandbox messages; receivers validate origin, tenant, plugin and request capabilities. */
export const pluginMessageEnvelopeSchema = z.strictObject({
  protocolVersion: z.literal(1),
  messageId: idSchema,
  requestId: idSchema.nullable(),
  tenantId: idSchema,
  pluginId: idSchema,
  incidentId: idSchema.nullable(),
  kind: z.enum(["get-record", "update-record", "subscribe", "unsubscribe", "result", "error"]),
  payload: jsonValueSchema,
});
export type PluginMessageEnvelope = z.infer<typeof pluginMessageEnvelopeSchema>;
