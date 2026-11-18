import { Dialog as DialogPrimitive } from "radix-ui";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { cn } from "../lib/cn.js";
import { TooltipProvider } from "./tooltip.js";

interface AppShellContextValue {
  /** Desktop sidebar collapsed to icons. */
  readonly collapsed: boolean;
  readonly setCollapsed: (collapsed: boolean) => void;
  /** Mobile/tablet drawer open. */
  readonly mobileOpen: boolean;
  readonly setMobileOpen: (open: boolean) => void;
  /** True while rendering inside the mobile drawer (sidebar shows full labels). */
  readonly inDrawer: boolean;
}

const AppShellContext = createContext<AppShellContextValue>({
  collapsed: false,
  setCollapsed: () => undefined,
  mobileOpen: false,
  setMobileOpen: () => undefined,
  inDrawer: false,
});

/** Shell layout state for sidebar/top bar controls. Safe outside AppShell (inert defaults). */
export function useAppShell(): AppShellContextValue {
  return useContext(AppShellContext);
}

export interface AppShellProps {
  /** Usually a <Sidebar>. Rendered in a fixed column on desktop and a drawer below 1024px. */
  readonly sidebar: ReactNode;
  readonly topBar: ReactNode;
  readonly children: ReactNode;
  /** Global banners (offline, conflicts) shown above route content. */
  readonly banners?: ReactNode;
  readonly sidebarCollapsed?: boolean;
  readonly defaultSidebarCollapsed?: boolean;
  readonly onSidebarCollapsedChange?: (collapsed: boolean) => void;
  readonly className?: string;
}

/**
 * Application frame: skip link, collapsible sidebar (drawer on tablet/phone), top status bar and
 * the main landmark. Performs no navigation, authorization or data loading.
 * Depends on: the host to enforce tenant/incident access before supplying route content.
 */
export function AppShell({
  sidebar,
  topBar,
  children,
  banners,
  sidebarCollapsed,
  defaultSidebarCollapsed = false,
  onSidebarCollapsedChange,
  className,
}: AppShellProps): ReactElement {
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = sidebarCollapsed ?? uncontrolledCollapsed;
  const setCollapsed = useCallback(
    (value: boolean) => {
      setUncontrolledCollapsed(value);
      onSidebarCollapsedChange?.(value);
    },
    [onSidebarCollapsedChange],
  );
  const value = useMemo(
    () => ({ collapsed, setCollapsed, mobileOpen, setMobileOpen, inDrawer: false }),
    [collapsed, setCollapsed, mobileOpen],
  );
  const drawerValue = useMemo(() => ({ ...value, collapsed: false, inDrawer: true }), [value]);

  return (
    <AppShellContext.Provider value={value}>
      <TooltipProvider>
        <div
          className={cn(
            "grid h-dvh grid-cols-1 bg-canvas text-fg lg:grid-cols-[var(--argus-shell-sidebar)_minmax(0,1fr)]",
            className,
          )}
          style={{
            ["--argus-shell-sidebar" as string]: collapsed
              ? "var(--argus-sidebar-w-collapsed)"
              : "var(--argus-sidebar-w)",
          }}
          data-sidebar-collapsed={collapsed || undefined}
        >
          <a className="argus-skip-link" href="#argus-main-content">
            Skip to main content
          </a>
          <div className="hidden min-h-0 border-e border-border bg-surface lg:flex lg:flex-col">
            {sidebar}
          </div>
          <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-(--argus-z-overlay) bg-overlay data-[state=open]:animate-argus-fade-in lg:hidden" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 start-0 z-(--argus-z-modal) flex w-72 max-w-[85vw] flex-col border-e border-border bg-surface shadow-lg outline-none data-[state=open]:animate-argus-slide-up lg:hidden"
                onClick={(event) => {
                  // Close the drawer after following a link.
                  if ((event.target as HTMLElement).closest("a[href]")) {
                    setMobileOpen(false);
                  }
                }}
              >
                <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                <AppShellContext.Provider value={drawerValue}>{sidebar}</AppShellContext.Provider>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
          <div className="flex min-h-0 min-w-0 flex-col">
            {topBar}
            <main
              id="argus-main-content"
              tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto outline-none"
            >
              {banners ? (
                <div className="grid gap-2 px-(--argus-page-p) pt-(--argus-page-p)">{banners}</div>
              ) : null}
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </AppShellContext.Provider>
  );
}

export interface PageContainerProps {
  readonly children: ReactNode;
  /** `wide` for boards/tables, `narrow` for forms and settings. */
  readonly width?: "narrow" | "default" | "wide" | "full";
  readonly className?: string;
}

const widthClasses = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[96rem]",
  full: "max-w-none",
} as const;

/** Standard page padding and max width inside the shell's main area. */
export function PageContainer({
  children,
  width = "default",
  className,
}: PageContainerProps): ReactElement {
  return (
    <div
      className={cn(
        "mx-auto grid w-full gap-(--argus-gap) p-(--argus-page-p) lg:gap-6",
        widthClasses[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
