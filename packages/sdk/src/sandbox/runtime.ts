import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { type ArgusPluginClient, createIframeClient } from "../client/create-client.js";
import {
  parseSandboxLoadMessage,
  SANDBOX_MAX_HEIGHT,
  type SandboxConsoleLevel,
  type SandboxLoadMessage,
  type SandboxToHostControlMessage,
} from "../protocol/sandbox-messages.js";
import { compileComponent, disallowedImportMessage, isAllowedImport } from "./compile.js";
import {
  type ComponentRuntimeStore,
  type ComponentTheme,
  createComponentSdk,
} from "./component-sdk.js";
import { formatConsoleArgs } from "./console-format.js";

const h = React.createElement;

/** Base stylesheet; components can rely on `var(--argus-*)` tokens being set on :root. */
export const SANDBOX_BASE_CSS = `
:root { color-scheme: light dark; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--argus-font-sans, system-ui, sans-serif);
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--argus-color-fg, #111827);
  background: transparent;
}
#root { display: flow-root; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: start; padding: 6px 8px; border-bottom: 1px solid var(--argus-color-border, #e5e7eb); }
th { font-weight: 600; color: var(--argus-color-fg-muted, #6b7280); }
:focus-visible { outline: 2px solid var(--argus-color-focus, #2563eb); outline-offset: 2px; }
`;

const HEARTBEAT_MS = 1_000;
const CLIENT_TIMEOUT_MS = 10_000;
const CONSOLE_LEVELS: readonly SandboxConsoleLevel[] = ["log", "info", "warn", "error", "debug"];
const CONSOLE_BURST = 100;

/** Best-effort `line:column` of user code from a V8 stack (wrapper adds two lines). */
function locationFromError(error: unknown): { line: number | null; column: number | null } {
  const stack = (error as { stack?: unknown } | null)?.stack;
  if (typeof stack !== "string") return { line: null, column: null };
  const match = /<anonymous>:(\d+):(\d+)/.exec(stack);
  if (!match) return { line: null, column: null };
  const line = Number(match[1]) - 2;
  return line >= 1 ? { line, column: Number(match[2]) } : { line: null, column: null };
}

function messageOf(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw.slice(0, 1_000);
}

interface ExecuteOk {
  readonly ok: true;
  readonly component: React.ComponentType;
}
interface ExecuteFail {
  readonly ok: false;
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
}

/**
 * Run compiled CommonJS in the iframe. `new Function` is acceptable ONLY here: this code runs inside
 * the opaque-origin sandboxed frame (CSP `unsafe-eval` is granted to that document alone).
 */
function executeModule(
  code: string,
  requireModule: (specifier: string) => unknown,
): ExecuteOk | ExecuteFail {
  try {
    const module: { exports: Record<string, unknown> } = { exports: {} };
    const factory = new Function("require", "exports", "module", "React", code) as (
      ...args: unknown[]
    ) => void;
    factory(requireModule, module.exports, module, React);
    const component = module.exports.default;
    if (typeof component !== "function") {
      return {
        ok: false,
        message: "The component must `export default` a React function component.",
        line: null,
        column: null,
      };
    }
    return { ok: true, component: component as React.ComponentType };
  } catch (error: unknown) {
    return { ok: false, message: messageOf(error), ...locationFromError(error) };
  }
}

class ErrorBoundary extends React.Component<
  { readonly onError: (error: unknown) => void; readonly children?: React.ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }
  override render(): React.ReactNode {
    if (this.state.failed) {
      return h(
        "div",
        { role: "alert", style: { color: "var(--argus-color-critical, #b91c1c)", padding: 8 } },
        "This component failed to render. See the console for details.",
      );
    }
    return this.props.children;
  }
}

function createStore(): ComponentRuntimeStore & {
  set(props: Readonly<Record<string, unknown>>, theme: ComponentTheme): void;
} {
  let props: Readonly<Record<string, unknown>> = {};
  let theme: ComponentTheme = { tokens: {}, density: "comfortable" };
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getProps: () => props,
    getTheme: () => theme,
    set(nextProps, nextTheme) {
      props = nextProps;
      theme = nextTheme;
      for (const l of listeners) l();
    },
  };
}

/**
 * Start the in-iframe runtime: wait for `sandbox.load` from the embedding host, compile the TSX with
 * sucrase, execute it with a two-module allowlist (`react`, `@argus/component-sdk`), render it with
 * React 19, and report ready / errors / console / size / heartbeat back to the host.
 * Returns a stop function (used by tests/harnesses).
 */
export function startSandboxRuntime(): () => void {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Sandbox document has no #root element.");

  const style = document.createElement("style");
  style.textContent = SANDBOX_BASE_CSS;
  document.head.appendChild(style);

  const store = createStore();
  let hostOrigin: string | null = null;
  let session: { sessionId: string; nonce: string } | null = null;
  let clientPromise: Promise<ArgusPluginClient> | null = null;
  let root: Root | null = null;
  let current: { source: string; version: number; key: number } | null = null;
  let renderKey = 0;
  // The client sees host traffic only through this shim, so user code cannot listen to it.
  const clientListeners = new Set<EventListener>();
  const clientWindow = {
    addEventListener: (_type: string, listener: EventListener): void => {
      clientListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: EventListener): void => {
      clientListeners.delete(listener);
    },
  } as unknown as Window;
  let lastHeight = -1;
  let consoleBudget = CONSOLE_BURST;
  const timers: Array<ReturnType<typeof setInterval>> = [];

  const send = (message: SandboxToHostControlMessage): void => {
    // Before the first load the host origin is unknown; boot carries no secret. Afterwards: exact origin.
    window.parent.postMessage(
      message,
      hostOrigin === null || hostOrigin === "null" ? "*" : hostOrigin,
    );
  };

  // ---- console capture (capped, never throws) --------------------------------------------------
  const originals = new Map<SandboxConsoleLevel, (...args: unknown[]) => void>();
  for (const level of CONSOLE_LEVELS) {
    const original = console[level].bind(console) as (...args: unknown[]) => void;
    originals.set(level, original);
    console[level] = (...args: unknown[]): void => {
      original(...args);
      if (!session || consoleBudget <= 0) return;
      consoleBudget -= 1;
      send({
        kind: "sandbox.console",
        sessionId: session.sessionId,
        level,
        args: formatConsoleArgs(args),
      });
    };
  }
  timers.push(
    setInterval(() => {
      consoleBudget = CONSOLE_BURST;
    }, 1_000),
  );

  const reportError = (
    phase: "compile" | "execute" | "render",
    message: string,
    line: number | null,
    column: number | null,
  ): void => {
    if (!session) return;
    send({
      kind: "sandbox.render-error",
      sessionId: session.sessionId,
      phase,
      message,
      line,
      column,
    });
  };

  const onWindowError = (event: ErrorEvent): void => {
    if (!session) return;
    send({
      kind: "sandbox.console",
      sessionId: session.sessionId,
      level: "error",
      args: formatConsoleArgs([event.message]),
    });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    if (!session) return;
    send({
      kind: "sandbox.console",
      sessionId: session.sessionId,
      level: "error",
      args: formatConsoleArgs([`Unhandled rejection: ${messageOf(event.reason)}`]),
    });
  };
  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onRejection);

  // ---- size reporting --------------------------------------------------------------------------
  let raf = 0;
  const reportSize = (): void => {
    raf = 0;
    if (!session) return;
    const height = Math.min(
      SANDBOX_MAX_HEIGHT,
      Math.ceil(rootElement.getBoundingClientRect().height),
    );
    if (height === lastHeight) return;
    lastHeight = height;
    send({ kind: "sandbox.resize", sessionId: session.sessionId, height });
  };
  const observer = new ResizeObserver(() => {
    if (raf === 0) raf = requestAnimationFrame(reportSize);
  });
  observer.observe(rootElement);

  // ---- sdk module + require ---------------------------------------------------------------------
  const sdk = createComponentSdk({
    store,
    getClient: () => clientPromise ?? Promise.reject(new Error("The host has not connected yet.")),
  });
  const requireModule = (specifier: string): unknown => {
    if (!isAllowedImport(specifier)) throw new Error(disallowedImportMessage(String(specifier)));
    return specifier === "react" ? React : sdk;
  };

  // ---- load handling ---------------------------------------------------------------------------
  const applyTheme = (message: SandboxLoadMessage): void => {
    const rootStyle = document.documentElement.style;
    for (const [name, value] of Object.entries(message.theme)) rootStyle.setProperty(name, value);
    document.documentElement.dataset.density = message.density;
  };

  const handleLoad = (message: SandboxLoadMessage): void => {
    applyTheme(message);
    store.set(message.props, { tokens: message.theme, density: message.density });

    if (clientPromise === null) {
      const hostWindow = window.parent;
      clientPromise = createIframeClient({
        pluginId: message.componentKey,
        installationId: "sandbox",
        manifestHash: "",
        hostOrigin: hostOrigin ?? "",
        hostWindow,
        pluginWindow: clientWindow,
        requestTimeoutMs: CLIENT_TIMEOUT_MS,
        sessionId: message.sessionId,
        handshakeNonce: message.handshakeNonce,
      });
      clientPromise.catch(() => undefined);
      timers.push(
        setInterval(() => {
          if (session) send({ kind: "sandbox.heartbeat", sessionId: session.sessionId });
        }, HEARTBEAT_MS),
      );
    }

    // Props/theme-only change: keep the mounted component, no recompile or remount.
    if (current && current.source === message.source && current.version === message.version) return;

    const compiled = compileComponent(message.source);
    if (!compiled.ok) {
      reportError("compile", compiled.error.message, compiled.error.line, compiled.error.column);
      return;
    }
    const executed = executeModule(compiled.code, requireModule);
    if (!executed.ok) {
      reportError("execute", executed.message, executed.line, executed.column);
      return;
    }
    renderKey += 1;
    current = { source: message.source, version: message.version, key: renderKey };
    const Component = executed.component;
    const version = message.version;
    const key = renderKey;
    const Ready = (): null => {
      React.useEffect(() => {
        if (session && current?.key === key) {
          send({ kind: "sandbox.ready", sessionId: session.sessionId, version });
          reportSize();
        }
      }, []);
      return null;
    };
    root ??= createRoot(rootElement);
    root.render(
      h(
        ErrorBoundary,
        {
          key,
          onError: (error: unknown) =>
            reportError("render", messageOf(error), ...locationPair(error)),
        },
        h(Component),
        h(Ready),
      ),
    );
  };

  const locationPair = (error: unknown): [number | null, number | null] => {
    const l = locationFromError(error);
    return [l.line, l.column];
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    // Only the embedding parent; never another frame or the user's own code.
    if (event.source !== window.parent) return;
    // Hide host traffic from user-registered listeners (defence in depth: they could otherwise read
    // the session id and nonce).
    event.stopImmediatePropagation();
    if (hostOrigin !== null && event.origin !== hostOrigin) return;
    const data = event.data as { kind?: unknown } | null;
    if (data === null || typeof data !== "object") return;
    if (data.kind !== "sandbox.load") {
      if (hostOrigin !== null) for (const listener of clientListeners) listener(event);
      return;
    }
    let message: SandboxLoadMessage;
    try {
      message = parseSandboxLoadMessage(event.data);
    } catch {
      return;
    }
    if (session !== null && session.sessionId !== message.sessionId) return;
    if (hostOrigin === null) {
      // Trust on first use: the page holds no secrets and only ever talks to its first embedder.
      hostOrigin = event.origin;
      session = { sessionId: message.sessionId, nonce: message.handshakeNonce };
    }
    handleLoad(message);
  };
  // Registered in the capture phase so it runs before any listener the user's code could add.
  window.addEventListener("message", onMessage, { capture: true });

  send({ kind: "sandbox.boot" });

  return () => {
    window.removeEventListener("message", onMessage, { capture: true });
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onRejection);
    for (const t of timers) clearInterval(t);
    if (raf !== 0) cancelAnimationFrame(raf);
    observer.disconnect();
    for (const [level, original] of originals) console[level] = original;
    void clientPromise?.then((c) => c.dispose()).catch(() => undefined);
    root?.unmount();
    style.remove();
  };
}
