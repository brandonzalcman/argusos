import type {
  AlertAcknowledgementReceipt,
  AlertAcknowledgementRequest,
  AssignedTask,
  BoardFormPreparation,
  BoardFormRequest,
  CapturedLocation,
  CapturedPhoto,
  CheckInReceipt,
  CheckInRequest,
  LocationCaptureRequest,
  MobileAccessContext,
  OfflineConflict,
  OfflineConflictResolution,
  OfflineDraft,
  PhotoCaptureRequest,
  PushRegistration,
  PushRegistrationRequest,
} from "./contracts.js";

/**
 * TODO(implementation): Authorize and persist an incident-scoped position check-in.
 * Input: A check-in request containing authenticated scope and claimed occurrence time.
 * Output: A server-issued receipt with its audit request identifier.
 * Errors: Rejects unauthenticated, cross-tenant, unauthorized, inactive-incident and transport calls.
 * Depends on: Authenticated mobile API, incident membership, position authorization and append-only audit.
 */
export function checkIn(_request: CheckInRequest): Promise<CheckInReceipt> {
  throw new Error("TODO(implementation): checkIn");
}

/**
 * TODO(implementation): Load only tasks readable by the current tenant, position and incident.
 * Input: Authenticated access scope, including an optional global or incident context.
 * Output: Assigned task projections carrying optimistic versions.
 * Errors: Rejects invalid scope, expired credentials, forbidden records and unavailable transport.
 * Depends on: Authorized task query API, tenant isolation and incident-scoped row security.
 */
export function loadAssignedTasks(_context: MobileAccessContext): Promise<readonly AssignedTask[]> {
  throw new Error("TODO(implementation): loadAssignedTasks");
}

/**
 * TODO(implementation): Project a shared, published board definition into an authorized mobile form.
 * Input: A board/view request with a shared BoardDefinition and optional expected record version.
 * Output: A renderer-neutral field projection with hidden and read-only fields resolved.
 * Errors: Rejects unpublished definitions, unknown views, forbidden fields and version mismatches.
 * Depends on: @argus/schema, server authorization, field permissions and optimistic version checks.
 */
export function prepareBoardForm(_request: BoardFormRequest): BoardFormPreparation {
  throw new Error("TODO(implementation): prepareBoardForm");
}

/**
 * TODO(implementation): Capture one user-initiated photo into encrypted application-owned storage.
 * Input: An incident-scoped draft and authenticated capture context.
 * Output: Device-private media metadata suitable for a later authorized upload.
 * Errors: Rejects denied permission, cancelled capture, storage failure and invalid draft scope.
 * Depends on: Expo camera/media APIs, consent UX, encrypted local storage and attachment virus scanning.
 */
export function capturePhoto(_request: PhotoCaptureRequest): Promise<CapturedPhoto> {
  throw new Error("TODO(implementation): capturePhoto");
}

/**
 * TODO(implementation): Capture one consented foreground GPS point without background tracking.
 * Input: An incident-scoped draft and authenticated capture context.
 * Output: Coordinates, capture time and available accuracy metadata.
 * Errors: Rejects denied permission, unavailable location, timeout and invalid draft scope.
 * Depends on: Expo Location, native permission declarations and an auditable draft store.
 */
export function captureLocation(_request: LocationCaptureRequest): Promise<CapturedLocation> {
  throw new Error("TODO(implementation): captureLocation");
}

/**
 * TODO(implementation): Register a push token for an authenticated user without subscribing to alerts.
 * Input: Authenticated tenant, user and position scope.
 * Output: Provider registration material for secure server-side device registration.
 * Errors: Rejects denied permission, unsupported device, provider outage and expired credentials.
 * Depends on: Expo Notifications, platform push providers and scoped server device registration.
 */
export function registerForPushNotifications(
  _request: PushRegistrationRequest,
): Promise<PushRegistration> {
  throw new Error("TODO(implementation): registerForPushNotifications");
}

/**
 * TODO(implementation): Submit an optimistic, idempotent acknowledgement for one alert delivery.
 * Input: Alert, delivery, incident scope and expected alert version.
 * Output: An auditable server acknowledgement receipt.
 * Errors: Rejects stale versions, duplicate identities, forbidden deliveries and transport failure.
 * Depends on: Alert API, position authorization, incident scoping, idempotency and audit history.
 */
export function acknowledgeAlert(
  _request: AlertAcknowledgementRequest,
): Promise<AlertAcknowledgementReceipt> {
  throw new Error("TODO(implementation): acknowledgeAlert");
}

/**
 * TODO(implementation): Persist an encrypted local draft without treating it as an operational record.
 * Input: Incident-scoped values, base record version and local capture references.
 * Output: The stored draft after device-local persistence succeeds.
 * Errors: Rejects cross-tenant scope, oversized content, storage failure and malformed draft identity.
 * Depends on: Encrypted Expo storage, schema validation and user-controlled retention settings.
 */
export function saveOfflineDraft(_draft: OfflineDraft): Promise<OfflineDraft> {
  throw new Error("TODO(implementation): saveOfflineDraft");
}

/**
 * TODO(implementation): List only the signed-in user's drafts in the current tenant and incident.
 * Input: Authenticated access scope used to partition encrypted local persistence.
 * Output: Local drafts, explicitly excluding submitted operational records.
 * Errors: Rejects invalid scope, unavailable storage and undecryptable local state.
 * Depends on: Per-user encrypted storage and tenant/incident partition keys.
 */
export function listOfflineDrafts(_context: MobileAccessContext): Promise<readonly OfflineDraft[]> {
  throw new Error("TODO(implementation): listOfflineDrafts");
}

/**
 * TODO(implementation): Replay local drafts with server authorization and per-field conflict detection.
 * Input: Authenticated tenant, user, position and optional incident scope.
 * Output: Same-field conflicts requiring explicit resolution; successful writes require separate receipts.
 * Errors: Rejects unauthorized changes, stale definitions and partial transport failures without data loss.
 * Depends on: Sync API, optimistic versions, idempotency keys, audit and server-side RLS.
 */
export function synchronizeOfflineDrafts(
  _context: MobileAccessContext,
): Promise<readonly OfflineConflict[]> {
  throw new Error("TODO(implementation): synchronizeOfflineDrafts");
}

/**
 * TODO(implementation): Resolve one same-field conflict without silently overwriting either value.
 * Input: An explicit keep-local or keep-server choice in the original incident scope.
 * Output: A conflict record marked resolved after server confirmation.
 * Errors: Rejects changed server versions, forbidden resolution and unknown conflict identifiers.
 * Depends on: Conflict store, optimistic mutation API, audit history and per-field authorization.
 */
export function resolveOfflineConflict(
  _resolution: OfflineConflictResolution,
): Promise<OfflineConflict> {
  throw new Error("TODO(implementation): resolveOfflineConflict");
}
