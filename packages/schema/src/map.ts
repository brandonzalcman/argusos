import { z } from "zod";
import { viewAccessPolicySchema } from "./access.js";
import { celExpressionSchema, idSchema, jsonValueSchema } from "./primitives.js";
import { tenantVersionedDefinitionBaseSchema } from "./versioning.js";

/**
 * External or board-backed layer source. Credential references are resolved server-side and never sent to clients.
 * Remote fetches require protocol, origin and egress allowlists to prevent SSRF and cross-tenant data disclosure.
 */
export const mapLayerSourceSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("board-records"),
    tableId: idSchema,
    locationFieldId: idSchema,
    filterExpression: celExpressionSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal("vector-tiles"),
    url: z.string().url().max(2_048),
    credentialReferenceId: idSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal("wms"),
    url: z.string().url().max(2_048),
    layers: z.array(z.string().min(1)),
    credentialReferenceId: idSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal("wfs"),
    url: z.string().url().max(2_048),
    typeName: z.string().min(1),
    credentialReferenceId: idSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal("arcgis-rest"),
    url: z.string().url().max(2_048),
    credentialReferenceId: idSchema.nullable(),
  }),
  z.strictObject({ type: z.literal("kml"), attachmentId: idSchema }),
  z.strictObject({ type: z.literal("geojson"), data: jsonValueSchema }),
  z.strictObject({ type: z.literal("live-feed"), feedId: idSchema, latestOnly: z.boolean() }),
]);
export type MapLayerSource = z.infer<typeof mapLayerSourceSchema>;

/** Map layer presentation. Style expressions are data, not arbitrary JavaScript, and are renderer-sandboxed. */
export const mapLayerDefinitionSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1).max(200),
  source: mapLayerSourceSchema,
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  minimumZoom: z.number().min(0).max(24).nullable(),
  maximumZoom: z.number().min(0).max(24).nullable(),
  style: z.record(z.string(), jsonValueSchema),
  access: viewAccessPolicySchema,
});
export type MapLayerDefinition = z.infer<typeof mapLayerDefinitionSchema>;

/** Versioned shared map. Board-backed layers inherit table, incident, row and field authorization. */
export const mapDefinitionSchema = tenantVersionedDefinitionBaseSchema.extend({
  name: z.string().min(1).max(200),
  center: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  zoom: z.number().min(0).max(24),
  layers: z.array(mapLayerDefinitionSchema),
  annotationsTableId: idSchema.nullable(),
  access: viewAccessPolicySchema,
});
export type MapDefinition = z.infer<typeof mapDefinitionSchema>;
