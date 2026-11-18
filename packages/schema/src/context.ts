import { z } from "zod";
import { definitionKeySchema, idSchema, timestampSchema } from "./primitives.js";

/** Tenant identity and lifecycle. Cross-tenant references are invalid unless a future sharing contract allows them. */
export const tenantSchema = z.strictObject({
  id: idSchema,
  slug: definitionKeySchema,
  name: z.string().min(1).max(200),
  status: z.enum(["active", "suspended", "archived"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Tenant = z.infer<typeof tenantSchema>;

/** Safe user projection for shared contracts. Credentials, MFA secrets and sessions are deliberately excluded. */
export const userSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  displayName: z.string().min(1).max(200),
  email: z.string().email().nullable(),
  status: z.enum(["invited", "active", "disabled"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type User = z.infer<typeof userSchema>;

/** Position is the RBAC principal used for homepage, board, record and field authorization. */
export const positionSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable(),
  homepageBoardId: idSchema.nullable(),
  isSystem: z.boolean(),
});
export type Position = z.infer<typeof positionSchema>;

/** Incident scope. Exercises remain isolated from live incidents even when cloned from them. */
export const incidentSchema = z.strictObject({
  id: idSchema,
  tenantId: idSchema,
  key: definitionKeySchema,
  name: z.string().min(1).max(200),
  kind: z.enum(["live", "exercise"]),
  status: z.enum(["planned", "active", "monitoring", "closed", "archived"]),
  level: z.number().int().min(0).max(10).nullable(),
  operationalPeriod: z.string().max(200).nullable(),
  activatedAt: timestampSchema.nullable(),
  closedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Incident = z.infer<typeof incidentSchema>;

/**
 * Server-established security context for one operation.
 * Clients may request a position/incident, but the API must derive these IDs from authenticated membership
 * and re-check every query, mutation, realtime subscription and audit write against the same context.
 */
export const operationContextSchema = z.strictObject({
  tenantId: idSchema,
  userId: idSchema,
  positionId: idSchema,
  incidentId: idSchema.nullable(),
  requestId: idSchema,
  authenticatedAt: timestampSchema,
});
export type OperationContext = z.infer<typeof operationContextSchema>;

/** Resolves whether a table operation requires an incident; global records must use a null incident ID. */
export const incidentScopeSchema = z.enum(["incident", "global"]);
export type IncidentScope = z.infer<typeof incidentScopeSchema>;
