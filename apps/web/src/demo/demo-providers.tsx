import type { ReactElement, ReactNode } from "react";
import { AdminServiceProvider } from "../features/admin/admin-service.js";
import { BoardsEnvironmentProvider } from "../features/boards/environment.js";
import { ActiveScopeProvider } from "../features/live-data/active-scope.js";
import { FeatureSourcesProvider } from "../features/live-data/feature-sources.js";
import { TablesDataProvider } from "../features/tables/tables-port.js";
import { FeatureSessionProvider } from "../features/workflows/feature-scope.js";
import { WorkflowServiceProvider } from "../features/workflows/workflow-service.js";
import { createDemoAdminService } from "./admin.js";
import { demoAlertsSource } from "./alerts.js";
import { createDemoBoardsEnvironment } from "./boards/index.js";
import { demoIncidentsSource } from "./incidents.js";
import { demoMapsSource } from "./maps.js";
import { DEMO_ACTOR, DEMO_SCOPE } from "./scenario.js";
import { createDemoTablesDataPort } from "./tables/index.js";
import { createDemoWorkflowService } from "./workflows.js";

const session = { scope: DEMO_SCOPE, actor: DEMO_ACTOR };
const featureSources = {
  incidents: demoIncidentsSource,
  alerts: demoAlertsSource,
  maps: demoMapsSource,
};
const tablesPort = createDemoTablesDataPort();
const boardsEnvironment = createDemoBoardsEnvironment();
const adminService = createDemoAdminService();
const workflowService = createDemoWorkflowService();

/** Permanent, non-dismissable notice so demo data is never mistaken for operational data. */
function DemoBanner(): ReactElement {
  return (
    <div
      role="note"
      aria-label="Demo mode"
      style={{
        background: "#7c2d12",
        color: "#fff7ed",
        fontSize: "0.8125rem",
        fontWeight: 600,
        padding: "0.25rem 1rem",
        textAlign: "center",
      }}
    >
      DEMO MODE: all incidents, people, places and records are fictional and live only in this
      browser tab. Nothing is sent to a server.
    </div>
  );
}

/**
 * Supplies every feature port with in-memory demo adapters plus a fixed demo scope and actor.
 * Input: application children. Output: the full provider stack and the demo banner.
 * Errors: none; demo adapters resolve with fictional data.
 * Depends on: isDemoMode() being true; mounted by AppProviders only in demo mode.
 */
export function DemoProviders({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <ActiveScopeProvider value={DEMO_SCOPE}>
      <FeatureSessionProvider value={session}>
        <FeatureSourcesProvider value={featureSources}>
          <TablesDataProvider port={tablesPort}>
            <BoardsEnvironmentProvider environment={boardsEnvironment}>
              <AdminServiceProvider value={adminService}>
                <WorkflowServiceProvider value={workflowService}>
                  <DemoBanner />
                  {children}
                </WorkflowServiceProvider>
              </AdminServiceProvider>
            </BoardsEnvironmentProvider>
          </TablesDataProvider>
        </FeatureSourcesProvider>
      </FeatureSessionProvider>
    </ActiveScopeProvider>
  );
}
