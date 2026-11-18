import { RouterProvider } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { AppProviders } from "./app/app-providers.js";
import { router } from "./routes/router.js";
import type { AppServices } from "./services/index.js";

export interface AppProps {
  readonly services?: AppServices;
}

/**
 * Connects the typed router to the application composition root.
 * Input: optional service overrides for authenticated integration or isolated tests.
 * Output: the SPA provider/router tree; no operational request is started by the scaffold.
 * Errors: route and service errors retain their future boundary/port semantics.
 * Depends on: AppProviders and the code-based TanStack route tree.
 */
export function App({ services }: AppProps): ReactElement {
  const providerProps = services === undefined ? {} : { services };
  return (
    <AppProviders {...providerProps}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
