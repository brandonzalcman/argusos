import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import type { AppServices } from "../services/index.js";

const AppServicesContext = createContext<AppServices | null>(null);

export interface AppServicesProviderProps {
  readonly services: AppServices;
  readonly children: ReactNode;
}

/**
 * Supplies the service composition root without opening connections during render.
 * Input: a complete AppServices object and application children.
 * Output: a React context provider; no service method is called eagerly.
 * Errors: none itself; consuming ports retain their documented errors.
 * Depends on: AppProviders or a test composition root with tenant-safe service instances.
 */
export function AppServicesProvider({
  services,
  children,
}: AppServicesProviderProps): ReactElement {
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

/**
 * Returns injected service ports for route/controller code.
 * Input: none; must be called beneath AppServicesProvider.
 * Output: the exact AppServices composition root supplied by the host.
 * Errors: throws if the provider is missing, preventing accidental unscoped global services.
 * Depends on: AppServicesProvider. Callers must still pass tenant/incident/actor context per call.
 */
export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error("useAppServices must be used within AppServicesProvider");
  }
  return services;
}
