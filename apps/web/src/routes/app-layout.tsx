import {
  AppShell,
  CommandPalette,
  type CommandPaletteItem,
  type CommandPaletteSource,
  ConnectionIndicator,
  cn,
  DensityControl,
  filterCommands,
  IconButton,
  Sidebar,
  SidebarItem,
  SidebarSection,
  ThemeToggle,
  ToastProvider,
  TopBar,
  UIPreferencesProvider,
  useCommandPaletteShortcut,
  useUIPreferences,
} from "@argus/ui";
import {
  Bell,
  Blocks,
  Code2,
  LayoutDashboard,
  LayoutGrid,
  Map as MapIcon,
  Settings,
  ShieldCheck,
  Siren,
  Table2,
  Workflow,
} from "@argus/ui/icons";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { type ReactElement, type ReactNode, useMemo, useState } from "react";
import { useAppServices } from "../app/services-provider.js";
import { BuilderExtensionsProvider } from "../features/boards/index.js";
import {
  DevModeProvider,
  incidentLevelStatus,
  useDevMode,
  useEjectBlock,
  useSessionSnapshot,
} from "../features/studio/index.js";
import { useFeatureSession } from "../features/workflows/feature-scope.js";
import type { CommandPalettePort } from "../services/command-palette.js";
import type { ActorContext, AppScope } from "../services/contracts.js";

interface NavigationItem {
  readonly to: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly keywords?: readonly string[];
}

const navigationSections: readonly { title: string; items: readonly NavigationItem[] }[] = [
  {
    title: "Operate",
    items: [
      { to: "/", label: "Operations home", icon: <LayoutDashboard />, keywords: ["dashboard"] },
      { to: "/incidents", label: "Incidents", icon: <Siren />, keywords: ["events", "exercises"] },
      { to: "/boards", label: "Boards", icon: <LayoutGrid /> },
      { to: "/maps", label: "Maps", icon: <MapIcon />, keywords: ["gis", "layers"] },
      { to: "/alerts", label: "Alerts", icon: <Bell />, keywords: ["notifications"] },
    ],
  },
  {
    title: "Build",
    items: [
      { to: "/tables", label: "Tables", icon: <Table2 />, keywords: ["data", "records"] },
      { to: "/workflows", label: "Workflows", icon: <Workflow />, keywords: ["automation"] },
    ],
  },
  {
    title: "Administer",
    items: [
      {
        to: "/admin",
        label: "Administration",
        icon: <ShieldCheck />,
        keywords: ["users", "roles"],
      },
      { to: "/admin/theme", label: "Theme & branding", icon: <Blocks /> },
    ],
  },
];

const settingsItem: NavigationItem = { to: "/settings", label: "Settings", icon: <Settings /> };

const navigationCommands: readonly CommandPaletteItem[] = [
  ...navigationSections.flatMap((section) => section.items),
  settingsItem,
].map((item) => ({
  id: `nav:${item.to}`,
  title: item.label,
  kind: "navigation" as const,
  targetId: item.to,
  ...(item.keywords ? { keywords: item.keywords } : {}),
}));

interface SessionContext {
  readonly scope: AppScope;
  readonly actor: ActorContext;
}

/**
 * TODO(implementation): derive the authenticated actor and active incident scope from the real auth
 * session once auth exists. Until then it reads the FeatureSession provider (demo mode supplies one);
 * null means no unscoped search is ever issued.
 */
function useSessionContext(): SessionContext | null {
  return useFeatureSession();
}

/** Adapts the federated CommandPalettePort to a palette source, refusing to search unscoped. */
function createPortSource(
  port: CommandPalettePort,
  session: SessionContext | null,
): CommandPaletteSource {
  return {
    id: "records",
    label: "Records, incidents and positions",
    search: async (query) => {
      if (!session) {
        throw new Error("Not connected — sign-in and incident scope are not available yet.");
      }
      if (query.trim().length === 0) {
        return [];
      }
      return port.search({ ...session, query, limit: 20 });
    },
  };
}

function DevModeToggle(): ReactElement | null {
  const { available, enabled, setEnabled } = useDevMode();
  if (!available) return null;
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => setEnabled(!enabled)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        enabled
          ? "border-accent bg-accent-subtle text-accent-text"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
      )}
    >
      <Code2 aria-hidden="true" className="size-4" />
      <span className="hidden md:inline">Dev mode</span>
      <span className="sr-only md:hidden">Dev mode</span>
      <span className="sr-only">{enabled ? " on" : " off"}</span>
    </button>
  );
}

function DevModeBanner(): ReactElement | null {
  const { enabled, permissions } = useDevMode();
  if (!enabled) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed border-accent bg-accent-subtle px-3 py-2 text-sm text-fg"
    >
      <Code2 aria-hidden="true" className="size-4 text-accent-text" />
      <span className="font-medium">Dev mode is on.</span>
      <span className="text-fg-muted">
        Boards and pages show edit controls. Changes are drafts until published
        {permissions.editCode ? "; you can also edit definition and component code." : "."}
      </span>
      <Link to="/studio" className="ms-auto font-medium text-accent-text hover:underline">
        Open Studio
      </Link>
    </div>
  );
}

function ShellControls(): ReactElement {
  const { theme, resolvedTheme, setTheme, density, setDensity } = useUIPreferences();
  return (
    <>
      <DevModeToggle />
      <IconButton
        label="Alerts (not connected)"
        icon={<Bell />}
        disabled
        className="hidden sm:inline-flex"
      />
      <div className="hidden lg:block">
        <DensityControl value={density} onChange={setDensity} hideLabel iconOnly />
      </div>
      <ThemeToggle value={theme} resolved={resolvedTheme} onChange={setTheme} />
    </>
  );
}

function Shell(): ReactElement {
  const services = useAppServices();
  const session = useSessionContext();
  const navigate = useNavigate();
  const { snapshot } = useSessionSnapshot();
  const { available: studioAvailable, enabled: devModeEnabled } = useDevMode();
  const ejectBlock = useEjectBlock();
  const builderExtensions = useMemo(() => ({ ejectBlock }), [ejectBlock]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const incident = snapshot?.activeIncident ?? null;
  useCommandPaletteShortcut(setPaletteOpen);

  const sources = useMemo<readonly CommandPaletteSource[]>(
    () => [
      {
        id: "navigation",
        label: "Go to",
        search: async (query) => filterCommands(navigationCommands, query, 12),
      },
      createPortSource(services.commandPalette, session),
    ],
    [services.commandPalette, session],
  );

  const onSelect = (item: CommandPaletteItem): void => {
    if (item.kind === "navigation") {
      void navigate({ to: item.targetId });
    }
    // TODO(implementation): route record/incident/position/action commands once providers exist.
  };

  const sidebar = (
    <Sidebar
      footer={
        <ul className="grid">
          <SidebarItem icon={settingsItem.icon} label={settingsItem.label}>
            <Link to={settingsItem.to} />
          </SidebarItem>
        </ul>
      }
    >
      {navigationSections.map((section) => (
        <SidebarSection key={section.title} title={section.title}>
          {section.items.map((item) => (
            <SidebarItem key={item.to} icon={item.icon} label={item.label}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" || item.to === "/admin" }}
              />
            </SidebarItem>
          ))}
          {section.title === "Build" && studioAvailable ? (
            <SidebarItem icon={<Code2 />} label="Studio">
              <Link to="/studio" />
            </SidebarItem>
          ) : null}
        </SidebarSection>
      ))}
    </Sidebar>
  );

  return (
    <AppShell
      sidebar={sidebar}
      topBar={
        <TopBar
          activeIncidentLabel={incident?.name ?? null}
          incidentLevel={
            incident?.level != null
              ? { label: `Level ${incident.level}`, status: incidentLevelStatus(incident.level) }
              : null
          }
          operationalPeriodLabel={incident?.operationalPeriod ?? null}
          positionLabel={snapshot?.position.name ?? null}
          connection={
            <ConnectionIndicator
              variant="pill"
              state="offline"
              stateDetail="Live services are not connected in this scaffold"
            />
          }
          onOpenCommandPalette={() => setPaletteOpen(true)}
          actions={<ShellControls />}
        />
      }
      banners={devModeEnabled ? <DevModeBanner /> : undefined}
    >
      <BuilderExtensionsProvider extensions={builderExtensions}>
        <Outlet />
      </BuilderExtensionsProvider>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        sources={sources}
        onSelect={onSelect}
      />
    </AppShell>
  );
}

/**
 * Root layout: preferences (theme/density), toasts, the shell with grouped navigation, the
 * status top bar and the command palette. Context values read "Not selected" until the session
 * and incident providers exist; no operational query is executed.
 * Depends on: session/incident providers for real labels and service adapters for status.
 */
export function AppLayout(): ReactElement {
  return (
    <UIPreferencesProvider>
      <ToastProvider>
        <DevModeProvider>
          <Shell />
        </DevModeProvider>
      </ToastProvider>
    </UIPreferencesProvider>
  );
}
