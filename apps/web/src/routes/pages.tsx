import { ScaffoldPage, type ScaffoldPageProps } from "@argus/ui";
import type { ReactElement } from "react";
import {
  TableDataPageRoute,
  TableDesignerPageRoute,
  TablesListPage,
} from "../features/tables/index.js";

type ScaffoldRouteComponent = () => ReactElement;

/**
 * Creates a static route component with an honest implementation handoff.
 * Input: title, purpose, and ordered implementation steps; no route data is supplied.
 * Output: a component rendering @argus/ui's accessible scaffold page.
 * Errors: none; future data-loading and authorization failures belong to route loaders.
 * Depends on: the owning vertical slice listed in each route's implementationOrder.
 */
function createScaffoldRoute({
  title,
  description,
  implementationOrder,
}: ScaffoldPageProps): ScaffoldRouteComponent {
  return function ScaffoldRoute(): ReactElement {
    return (
      <ScaffoldPage
        title={title}
        description={description}
        implementationOrder={implementationOrder}
      />
    );
  };
}

export { OperationsHome as OperationsHomePage } from "../features/home/home-page.js";

export { IncidentsPage } from "../features/incidents/incidents-page.js";

export const TablesPage = TablesListPage;

export const TableDataPage = TableDataPageRoute;

export const TableDesignerPage = TableDesignerPageRoute;

export {
  AdminPage,
  MenuAdminPage,
  PositionHomepagesPage,
  SettingsPage,
  ThemeAdminPage,
} from "../features/admin/admin-pages.js";
export { AlertsPage } from "../features/alerts/alerts-page.js";
export {
  BoardBuilderPage,
  BoardDiffPage,
  BoardRuntimePage,
  BoardsListPage as BoardsPage,
} from "../features/boards/index.js";
export { MapsPage } from "../features/maps/maps-page.js";
export { PageBuilderPage, PageRuntimePage } from "../features/pages/index.js";
export { ComponentEditorPage, StudioIndexPage } from "../features/studio/index.js";
export { WorkflowEditorPage, WorkflowsPage } from "../features/workflows/workflows-pages.js";

export const NotFoundPage = createScaffoldRoute({
  title: "Page not found",
  description:
    "The requested route does not exist. No resource existence is inferred or disclosed.",
  implementationOrder: [
    "Keep this accessible fallback while route-specific not-found loaders are introduced.",
  ],
});
