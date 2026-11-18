import type { BoardDefinition } from "@argus/schema";

/** An ISO-8601 timestamp supplied by a trusted server or device clock. */
export type IsoDateTime = string;

/**
 * Authenticated scope attached to every mobile operation; implementations must re-authorize it on
 * the server and must never treat these client-provided identifiers as proof of access.
 */
export interface MobileAccessContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly positionId: string;
  readonly incidentId: string | null;
  readonly exerciseMode: boolean;
}

/** An access scope narrowed to one live incident or explicitly isolated exercise. */
export interface IncidentAccessContext extends MobileAccessContext {
  readonly incidentId: string;
}

/** Input for a position check-in; the server remains authoritative for identity and time. */
export interface CheckInRequest {
  readonly context: IncidentAccessContext;
  readonly occurredAt: IsoDateTime;
  readonly note?: string;
}

/** Server-issued receipt for an auditable position check-in. */
export interface CheckInReceipt {
  readonly checkInId: string;
  readonly acceptedAt: IsoDateTime;
  readonly auditRequestId: string;
}

/** A task projection sanitized for the authenticated tenant, position and incident. */
export interface AssignedTask {
  readonly taskId: string;
  readonly title: string;
  readonly incidentId: string;
  readonly dueAt: IsoDateTime | null;
  readonly version: number;
}

/** Request to prepare one shared board definition for mobile display or record entry. */
export interface BoardFormRequest {
  readonly context: IncidentAccessContext;
  readonly definition: BoardDefinition;
  readonly viewId: string;
  readonly recordId?: string;
  readonly expectedVersion?: number;
}

/** A renderer-neutral mobile board projection; it contains no executable plugin code. */
export interface BoardFormPreparation {
  readonly boardId: string;
  readonly viewId: string;
  readonly fieldIds: readonly string[];
  readonly readOnlyFieldIds: readonly string[];
}

/** Input for an intentional, foreground photo capture associated with an incident draft. */
export interface PhotoCaptureRequest {
  readonly context: IncidentAccessContext;
  readonly draftId: string;
}

/** Local media metadata; the URI is device-private and must not appear in logs or analytics. */
export interface CapturedPhoto {
  readonly localId: string;
  readonly localUri: string;
  readonly capturedAt: IsoDateTime;
  readonly mimeType: "image/jpeg";
}

/** Input for explicit foreground GPS capture, never background tracking. */
export interface LocationCaptureRequest {
  readonly context: IncidentAccessContext;
  readonly draftId: string;
}

/** A captured point and accuracy metadata, subject to user consent and incident authorization. */
export interface CapturedLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMetres: number | null;
  readonly capturedAt: IsoDateTime;
}

/** Input for registering a device token without granting alert access to the device alone. */
export interface PushRegistrationRequest {
  readonly context: MobileAccessContext;
}

/** Opaque provider registration material that must be stored and transmitted only over a secure channel. */
export interface PushRegistration {
  readonly providerToken: string;
  readonly registeredAt: IsoDateTime;
}

/** Input for acknowledging a specific alert delivery with optimistic concurrency protection. */
export interface AlertAcknowledgementRequest {
  readonly context: IncidentAccessContext;
  readonly alertId: string;
  readonly deliveryId: string;
  readonly expectedVersion: number;
  readonly acknowledgedAt: IsoDateTime;
}

/** Server confirmation that an acknowledgement was accepted and appended to audit history. */
export interface AlertAcknowledgementReceipt {
  readonly acknowledgementId: string;
  readonly acceptedAt: IsoDateTime;
  readonly auditRequestId: string;
}

/** A local, incident-scoped mutation awaiting authenticated replay and conflict detection. */
export interface OfflineDraft {
  readonly draftId: string;
  readonly context: IncidentAccessContext;
  readonly boardId: string;
  readonly viewId: string;
  readonly recordId: string | null;
  readonly baseVersion: number | null;
  readonly values: Readonly<Record<string, unknown>>;
  readonly photoLocalIds: readonly string[];
  readonly location: CapturedLocation | null;
  readonly updatedAt: IsoDateTime;
}

/** A same-field conflict requiring an explicit user decision; no silent last-write-wins merge. */
export interface OfflineConflict {
  readonly conflictId: string;
  readonly draftId: string;
  readonly recordId: string;
  readonly fieldId: string;
  readonly baseValue: unknown;
  readonly localValue: unknown;
  readonly serverValue: unknown;
  readonly serverVersion: number;
}

/** Explicit conflict resolution for one field, retaining both actor and incident audit scope. */
export interface OfflineConflictResolution {
  readonly context: IncidentAccessContext;
  readonly conflictId: string;
  readonly choice: "keep-local" | "keep-server";
}
