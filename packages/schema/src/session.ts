import { z } from "zod";
import { incidentSchema, positionSchema, tenantSchema, userSchema } from "./context.js";
import { idSchema } from "./primitives.js";

/**
 * Builder ("dev mode") permissions for the current position. Server-authoritative: the UI hides
 * what is false, and every studio procedure re-checks the same permission.
 */
export const studioPermissionsSchema = z.strictObject({
  /** May open dev mode and see drafts. */
  viewStudio: z.boolean(),
  /** May create and edit drafts with the visual (no-code) builder. */
  editDefinitions: z.boolean(),
  /** May publish drafts and roll back published versions. */
  publishDefinitions: z.boolean(),
  /** May edit raw definition JSON and custom component source code. */
  editCode: z.boolean(),
});
export type StudioPermissions = z.infer<typeof studioPermissionsSchema>;

/**
 * What the web app knows about the signed-in session. The server derives every value from
 * authenticated membership; the client never supplies tenant, user or position ids as authority.
 */
export const sessionSnapshotSchema = z.strictObject({
  user: userSchema,
  tenant: tenantSchema,
  position: positionSchema,
  /** Positions this user may switch to (assignments valid now). */
  availablePositions: z.array(positionSchema),
  /** Incident currently selected for this session, if any. */
  activeIncident: incidentSchema.nullable(),
  studio: studioPermissionsSchema,
});
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;

/** Request to act as another assigned position; the server verifies the assignment and audits it. */
export const selectPositionInputSchema = z.strictObject({ positionId: idSchema });
export type SelectPositionInput = z.infer<typeof selectPositionInputSchema>;

/** Request to switch the active incident (null = none); the server verifies access and audits it. */
export const selectIncidentInputSchema = z.strictObject({ incidentId: idSchema.nullable() });
export type SelectIncidentInput = z.infer<typeof selectIncidentInputSchema>;
