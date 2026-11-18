import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement, type ReactNode, useState } from "react";
import { isDemoMode } from "../demo/demo-mode.js";
import { DemoProviders } from "../demo/demo-providers.js";
import { createDemoServices } from "../demo/services.js";
import { type AppServices, createScaffoldServices } from "../services/index.js";
import { AppServicesProvider } from "./services-provider.js";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly services?: AppServices;
}

/**
 * Composes TanStack Query and application service providers without starting operational I/O.
 * Input: route content and an optional fully scoped service override for integration/tests.
 * Output: stable QueryClient and service contexts for the component lifetime. In demo mode
 * (VITE_ARGUS_DEMO=true, never the default) every port is an in-memory fictional-data adapter.
 * Errors: service behavior is deferred to method calls; no failing stub is invoked here.
 * Depends on: @tanstack/react-query and createScaffoldServices or authenticated real adapters.
 */
export function AppProviders({ children, services }: AppProvidersProps): ReactElement {
  const [queryClient] = useState(() => new QueryClient());
  const [demo] = useState(() => services === undefined && isDemoMode());
  const [appServices] = useState(
    () => services ?? (demo ? createDemoServices() : createScaffoldServices()),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AppServicesProvider services={appServices}>
        {demo ? <DemoProviders>{children}</DemoProviders> : children}
      </AppServicesProvider>
    </QueryClientProvider>
  );
}
