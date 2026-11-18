import type {
  SelectIncidentInput,
  SelectPositionInput,
  SessionSnapshot,
  StudioApi,
} from "@argus/schema";
import { createContext, createElement, type ReactElement, type ReactNode, useContext } from "react";

/**
 * Dev-mode ("studio") definition API as seen by the web app. Identical to the shared `StudioApi`
 * contract in @argus/schema so the tRPC client adapter (backend thread) and demo adapter can be
 * swapped without touching feature code.
 */
export type StudioPort = StudioApi;

function studioNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): StudioPort.${method}`);
}

/**
 * TODO(implementation): replace with the typed tRPC `studio` router client from apps/api.
 * Input: StudioApi requests; tenant/user/position come from the server session, never the client.
 * Output: a port whose methods throw; no definition, draft or version is fabricated.
 * Errors: every method throws TODO(implementation); UIs render an explicit "not connected" state.
 * Depends on: apps/api studio router, StudioPermissions checks, optimistic versions, audit.
 */
export function createStudioStub(): StudioPort {
  return {
    list: () => studioNotImplemented("list"),
    get: () => studioNotImplemented("get"),
    getPageBySlug: () => studioNotImplemented("getPageBySlug"),
    listVersions: () => studioNotImplemented("listVersions"),
    create: () => studioNotImplemented("create"),
    saveDraft: () => studioNotImplemented("saveDraft"),
    publish: () => studioNotImplemented("publish"),
    rollback: () => studioNotImplemented("rollback"),
    archive: () => studioNotImplemented("archive"),
    validate: () => studioNotImplemented("validate"),
  };
}

/** Session API (`session` tRPC router): who am I, which position/incident am I acting in. */
export interface SessionPort {
  /** Resolves null when signed out. */
  readonly get: () => Promise<SessionSnapshot | null>;
  readonly selectPosition: (input: SelectPositionInput) => Promise<SessionSnapshot>;
  readonly selectIncident: (input: SelectIncidentInput) => Promise<SessionSnapshot>;
}

/**
 * TODO(implementation): replace with the typed tRPC `session` router client from apps/api.
 * Output: `get` resolves null (signed out) so the app renders honest "Not selected" context;
 * the select methods throw TODO(implementation).
 */
export function createSessionStub(): SessionPort {
  return {
    get: async () => null,
    selectPosition: () => {
      throw new Error("TODO(implementation): SessionPort.selectPosition");
    },
    selectIncident: () => {
      throw new Error("TODO(implementation): SessionPort.selectIncident");
    },
  };
}

interface StudioServices {
  readonly studio: StudioPort;
  readonly session: SessionPort;
}

const defaultStudioServices: StudioServices = {
  studio: createStudioStub(),
  session: createSessionStub(),
};

const StudioServicesContext = createContext<StudioServices>(defaultStudioServices);

export interface StudioServicesProviderProps {
  readonly studio?: StudioPort;
  readonly session?: SessionPort;
  readonly children: ReactNode;
}

/** Injects real (tRPC), demo or test studio/session ports. Defaults are the stubs above. */
export function StudioServicesProvider({
  studio,
  session,
  children,
}: StudioServicesProviderProps): ReactElement {
  const value: StudioServices = {
    studio: studio ?? defaultStudioServices.studio,
    session: session ?? defaultStudioServices.session,
  };
  return createElement(StudioServicesContext.Provider, { value }, children);
}

export function useStudioPort(): StudioPort {
  return useContext(StudioServicesContext).studio;
}

export function useSessionPort(): SessionPort {
  return useContext(StudioServicesContext).session;
}
