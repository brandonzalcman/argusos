import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "./app-layout.js";
import {
  AdminPage,
  AlertsPage,
  BoardBuilderPage,
  BoardDiffPage,
  BoardRuntimePage,
  BoardsPage,
  ComponentEditorPage,
  IncidentsPage,
  MapsPage,
  MenuAdminPage,
  NotFoundPage,
  OperationsHomePage,
  PageBuilderPage,
  PageRuntimePage,
  PositionHomepagesPage,
  SettingsPage,
  StudioIndexPage,
  TableDataPage,
  TableDesignerPage,
  TablesPage,
  ThemeAdminPage,
  WorkflowEditorPage,
  WorkflowsPage,
} from "./pages.js";

const rootRoute = createRootRoute({ component: AppLayout });
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OperationsHomePage,
});
const incidentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/incidents",
  component: IncidentsPage,
});
const tablesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tables",
  component: TablesPage,
});
const tableDataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tables/$tableId",
  component: TableDataPage,
});
const tableDesignerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tables/$tableId/design",
  component: TableDesignerPage,
});
const boardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/boards",
  component: BoardsPage,
});
const boardRuntimeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/boards/$boardId",
  component: BoardRuntimePage,
});
const boardBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/boards/$boardId/builder",
  component: BoardBuilderPage,
});
const boardDiffRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/boards/$boardId/diff",
  component: BoardDiffPage,
});
const workflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows",
  component: WorkflowsPage,
});
const workflowEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows/$workflowId",
  component: WorkflowEditorPage,
});
const mapsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maps",
  component: MapsPage,
});
const alertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/alerts",
  component: AlertsPage,
});
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});
const themeAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/theme",
  component: ThemeAdminPage,
});
const menuAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/menus",
  component: MenuAdminPage,
});
const positionHomepagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/positions",
  component: PositionHomepagesPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/studio",
  component: StudioIndexPage,
});
const pageBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/studio/pages/$pageId",
  component: PageBuilderPage,
});
const componentEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/studio/components/$componentId",
  component: ComponentEditorPage,
});
const pageRuntimeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/p/$slug",
  component: PageRuntimePage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  incidentsRoute,
  tablesRoute,
  tableDataRoute,
  tableDesignerRoute,
  boardsRoute,
  boardRuntimeRoute,
  boardBuilderRoute,
  boardDiffRoute,
  workflowsRoute,
  workflowEditorRoute,
  mapsRoute,
  alertsRoute,
  adminRoute,
  themeAdminRoute,
  menuAdminRoute,
  positionHomepagesRoute,
  settingsRoute,
  studioRoute,
  pageBuilderRoute,
  componentEditorRoute,
  pageRuntimeRoute,
]);

/** Typed SPA router. Data authorization belongs in future beforeLoad/loaders, not components. */
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultNotFoundComponent: NotFoundPage,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
