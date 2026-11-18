import { CircleCheck, Info, OctagonAlert, TriangleAlert, X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
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
import { focusRing } from "../lib/focus.js";
import { buttonClasses } from "./button.js";

export type ToastTone = "neutral" | "info" | "success" | "warning" | "critical";

export interface ToastAction {
  readonly label: string;
  /** Describes how to do the same thing without the toast (required by Radix for a11y). */
  readonly altText: string;
  readonly onAction: () => void;
}

export interface ToastOptions {
  readonly title: string;
  readonly description?: string;
  readonly tone?: ToastTone;
  /** Milliseconds; defaults to 6000, or until dismissed for critical toasts. */
  readonly duration?: number;
  /** One action such as "Undo" or "Show". */
  readonly action?: ToastAction;
}

interface ToastRecord extends ToastOptions {
  readonly id: string;
  readonly open: boolean;
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  readonly toast: (options: ToastOptions) => string;
  readonly dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Imperative toast API. Must be used beneath ToastProvider (AppShell hosts don't add one). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return api;
}

const toneIcon: Readonly<Record<ToastTone, ReactNode>> = {
  neutral: <Info />,
  info: <Info />,
  success: <CircleCheck />,
  warning: <TriangleAlert />,
  critical: <OctagonAlert />,
};

const toneAccent: Readonly<Record<ToastTone, string>> = {
  neutral: "text-fg-muted",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  critical: "text-critical",
};

const toneBar: Readonly<Record<ToastTone, string>> = {
  neutral: "before:bg-border-strong",
  info: "before:bg-info-solid",
  success: "before:bg-success-solid",
  warning: "before:bg-warning-solid",
  critical: "before:bg-critical-solid",
};

let toastCounter = 0;

export interface ToastProviderProps {
  readonly children: ReactNode;
  /** Label for the toast region landmark (F8 jumps to it). */
  readonly label?: string;
}

/**
 * Hosts transient notifications in the bottom-end corner. Non-critical toasts are polite;
 * critical toasts are assertive and stay until dismissed. Keyboard: F8 focuses the region.
 */
export function ToastProvider({
  children,
  label = "Notifications",
}: ToastProviderProps): ReactElement {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) =>
      current.map((item) => (item.id === id ? { ...item, open: false } : item)),
    );
    // Remove after the exit animation so Radix can restore focus cleanly.
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 250);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    toastCounter += 1;
    const id = `argus-toast-${toastCounter}`;
    setToasts((current) => [...current.slice(-4), { ...options, id, open: true }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right" label={label}>
        {children}
        {toasts.map((item) => {
          const tone = item.tone ?? "neutral";
          const critical = tone === "critical";
          return (
            <ToastPrimitive.Root
              key={item.id}
              open={item.open}
              onOpenChange={(open) => (open ? undefined : dismiss(item.id))}
              type={critical ? "foreground" : "background"}
              duration={item.duration ?? (critical ? Number.POSITIVE_INFINITY : 6000)}
              className={cn(
                "relative flex w-full items-start gap-3 overflow-hidden rounded-md border border-border bg-surface-raised py-3 ps-4 pe-2 text-fg shadow-lg",
                "before:absolute before:inset-y-0 before:start-0 before:w-1",
                toneBar[tone],
                "data-[state=open]:animate-argus-slide-up data-[state=closed]:animate-argus-fade-in data-[state=closed]:[animation-direction:reverse]",
                "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x)",
              )}
            >
              <span aria-hidden="true" className={cn("mt-0.5 [&_svg]:size-4.5", toneAccent[tone])}>
                {toneIcon[tone]}
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <ToastPrimitive.Title className="text-base font-semibold">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="text-sm text-fg-muted">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
              {item.action ? (
                <ToastPrimitive.Action
                  altText={item.action.altText}
                  onClick={item.action.onAction}
                  className={buttonClasses("secondary", "sm", "mt-px")}
                >
                  {item.action.label}
                </ToastPrimitive.Action>
              ) : null}
              <ToastPrimitive.Close
                aria-label="Dismiss notification"
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-surface-hover hover:text-fg",
                  focusRing,
                )}
              >
                <X aria-hidden="true" className="size-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed end-0 bottom-0 z-(--argus-z-toast) m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
