import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { ActorContext, AppScope } from "../../services/contracts.js";
import { useFeatureSession } from "../workflows/feature-scope.js";
import type { AccountSession, LogoUploadResult } from "../workflows/local-types.js";

/** Typed boundary for the signed-in user's sessions. Tokens and secrets never cross this port. */
export interface SessionManagementPort {
  readonly listSessions: (
    scope: AppScope,
    actor: ActorContext,
  ) => Promise<readonly AccountSession[]>;
  /** Revokes one session other than the current one; the server rejects revoking the current session. */
  readonly revokeSession: (
    scope: AppScope,
    actor: ActorContext,
    sessionId: string,
  ) => Promise<void>;
}

export interface LogoUploadRequest {
  readonly scope: AppScope;
  readonly actor: ActorContext;
  readonly file: File;
}

/** Typed boundary for tenant logo storage in S3-compatible object storage. */
export interface LogoUploadPort {
  /** Stores an already client-validated image and returns its attachment id. */
  readonly uploadLogo: (request: LogoUploadRequest) => Promise<LogoUploadResult>;
}

function notImplemented(method: string): Promise<never> {
  return Promise.reject(new Error(`TODO(implementation): ${method}`));
}

/**
 * TODO(implementation): list and revoke the user's sessions through the auth service.
 * Input: scoped actor requests. Output: a port whose methods reject until implemented.
 * Errors: every method rejects with TODO(implementation); the future API audits revocations.
 * Depends on: better-auth session store, apps/api session routes, audit log.
 */
export function createSessionManagementStub(): SessionManagementPort {
  return {
    listSessions: () => notImplemented("SessionManagementPort.listSessions"),
    revokeSession: () => notImplemented("SessionManagementPort.revokeSession"),
  };
}

/**
 * TODO(implementation): upload tenant logos to object storage via a presigned, scanned upload.
 * Input: a scoped File. Output: a port whose method rejects until implemented.
 * Errors: rejects with TODO(implementation); the future API enforces type, size and malware checks.
 * Depends on: apps/api attachments route, S3-compatible storage, content scanning.
 */
export function createLogoUploadStub(): LogoUploadPort {
  return { uploadLogo: () => notImplemented("LogoUploadPort.uploadLogo") };
}

const SessionsContext = createContext<SessionManagementPort>(createSessionManagementStub());
const LogoContext = createContext<LogoUploadPort>(createLogoUploadStub());

/** Provider to inject a real or test session-management adapter. */
export const SessionManagementProvider = SessionsContext.Provider;
/** Provider to inject a real or test logo-upload adapter. */
export const LogoUploadProvider = LogoContext.Provider;

/** Maximum logo size and accepted types; SVG is excluded because it can carry script. */
export const LOGO_MAX_BYTES = 512 * 1024;
export const LOGO_ACCEPTED_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

/** Client-side check before upload; the server re-validates. Returns a message or null. */
export function validateLogoFile(file: { readonly type: string; readonly size: number }): string | null {
  if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
    return "Use a PNG, JPEG or WebP image. SVG logos are not accepted.";
  }
  if (file.size > LOGO_MAX_BYTES) {
    return `The image is ${(file.size / 1024).toFixed(0)} KB; the limit is ${LOGO_MAX_BYTES / 1024} KB.`;
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  return null;
}

/** Lists the current user's sessions. Disabled without a session scope. */
export function useAccountSessions() {
  const session = useFeatureSession();
  const port = useContext(SessionsContext);
  return useQuery({
    queryKey: ["account-sessions", session?.scope.tenantId ?? null, session?.actor.userId ?? null],
    enabled: session !== null,
    retry: false,
    queryFn: () => port.listSessions((session as NonNullable<typeof session>).scope, (session as NonNullable<typeof session>).actor),
  });
}

/** Revokes another session, then refreshes the list. */
export function useRevokeSession() {
  const session = useFeatureSession();
  const port = useContext(SessionsContext);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => {
      if (!session) return Promise.reject(new Error("No session scope available"));
      return port.revokeSession(session.scope, session.actor, sessionId);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["account-sessions"] }),
  });
}

/** Uploads a logo file through the typed port. */
export function useLogoUpload() {
  const session = useFeatureSession();
  const port = useContext(LogoContext);
  return useMutation({
    mutationFn: (file: File) => {
      if (!session) return Promise.reject(new Error("No session scope available"));
      return port.uploadLogo({ scope: session.scope, actor: session.actor, file });
    },
  });
}
