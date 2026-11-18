import { createContext, useContext } from "react";
import { type AlertsSource, alertsSourceStub } from "../alerts/alerts-source.js";
import { type IncidentsSource, incidentsSourceStub } from "../incidents/incidents-source.js";
import { type MapsSource, mapsSourceStub } from "../maps/maps-source.js";

/** Data ports for the operations features that do not have their own provider. */
export interface FeatureSources {
  readonly incidents: IncidentsSource;
  readonly alerts: AlertsSource;
  readonly maps: MapsSource;
}

const FeatureSourcesContext = createContext<FeatureSources>({
  incidents: incidentsSourceStub,
  alerts: alertsSourceStub,
  maps: mapsSourceStub,
});

/** Injects real, demo or test sources; without a provider the throwing stubs are used. */
export const FeatureSourcesProvider = FeatureSourcesContext.Provider;

export function useFeatureSources(): FeatureSources {
  return useContext(FeatureSourcesContext);
}
