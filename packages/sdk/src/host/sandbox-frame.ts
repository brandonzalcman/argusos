import type { PluginCapability as ComponentCapability } from "@argus/schema";
import { createElement as h, type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import {
  grantsFromComponentCapabilities,
  type PluginSecurityScope,
} from "../protocol/capabilities.js";
import { ProtocolError } from "../protocol/parse.js";
import {
  clampSandboxHeight,
  isSandboxControlKind,
  parseSandboxLoadMessage,
  parseSandboxToHostMessage,
  type SandboxConsoleLevel,
  type SandboxDensity,
  type SandboxLoadMessage,
} from "../protocol/sandbox-messages.js";
import { createHostBridge, type HostBridge, type HostBridgeServices } from "./bridge.js";

export const DEFAULT_SANDBOX_URL = "/sandbox/component.html";

/** CSS variables forwarded to the frame (resolved values, read from the host document). */
export const THEME_TOKEN_NAMES: readonly string[] = [
  "--argus-color-bg",
  "--argus-color-surface",
  "--argus-color-surface-raised",
  "--argus-color-surface-sunken",
  "--argus-color-surface-hover",
  "--argus-color-border",
  "--argus-color-border-strong",
  "--argus-color-fg",
  "--argus-color-fg-muted",
  "--argus-color-fg-subtle",
  "--argus-color-accent",
  "--argus-color-accent-hover",
  "--argus-color-accent-subtle",
  "--argus-color-accent-text",
  "--argus-color-on-accent",
  "--argus-color-focus",
  "--argus-color-critical",
  "--argus-color-critical-solid",
  "--argus-color-critical-subtle",
  "--argus-color-high",
  "--argus-color-high-solid",
  "--argus-color-high-subtle",
  "--argus-color-warning",
  "--argus-color-warning-solid",
  "--argus-color-warning-subtle",
  "--argus-color-success",
  "--argus-color-success-solid",
  "--argus-color-success-subtle",
  "--argus-color-info",
  "--argus-color-info-solid",
  "--argus-color-info-subtle",
  "--argus-radius-sm",
  "--argus-radius-md",
  "--argus-radius-lg",
  "--argus-font-sans",
  "--argus-font-mono",
  "--argus-gap",
  "--argus-panel-p",
  "--argus-control-h",
  "--argus-control-h-sm",
  "--argus-control-h-lg",
  "--argus-control-px",
  "--argus-row-h",
];

/** Read the resolved values of the theme variables from a host element (defaults to <html>). */
export function resolveThemeTokens(
  element: Element = document.documentElement,
): Record<string, string> {
  const computed = getComputedStyle(element);
  const tokens: Record<string, string> = {};
  for (const name of THEME_TOKEN_NAMES) {
    const value = computed.getPropertyValue(name).trim();
    if (value) tokens[name] = value;
  }
  return tokens;
}

export type SandboxFrameEvent =
  | { readonly type: "ready"; readonly version: number }
  | {
      readonly type: "error";
      readonly phase: "compile" | "execute" | "render" | "load";
      readonly message: string;
      readonly line: number | null;
      readonly column: number | null;
    }
  | {
      readonly type: "console";
      readonly level: SandboxConsoleLevel;
      readonly args: readonly string[];
    }
  | { readonly type: "resize"; readonly height: number }
  /** The frame stopped sending heartbeats and was torn down (likely an infinite loop). */
  | { readonly type: "stalled" }
  /** The frame navigated away from its document and was torn down. */
  | { readonly type: "navigated" };

export interface SandboxFrameIdentity {
  readonly tenantId: string;
  readonly actorUserId: string | null;
  readonly actorPositionId: string | null;
  readonly authorizationRevision: number;
}

export interface SandboxFrameProps {
  /** TSX source of the custom component. Untrusted; executed only inside the iframe. */
  readonly source: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly componentKey: string;
  readonly version: number;
  /** Declared capabilities of the component; the bridge enforces them on every request. */
  readonly capabilities: readonly ComponentCapability[];
  /** Data access provided by the host app (already tenant/incident/RLS/FLS aware). */
  readonly services: HostBridgeServices;
  readonly onEvent?: (event: SandboxFrameEvent) => void;
  /** Accessible name of the iframe (required). */
  readonly title: string;
  readonly className?: string;
  /** URL of the sandbox document. Default "/sandbox/component.html". */
  readonly sandboxUrl?: string;
  /** Explicit theme tokens; defaults to the resolved values on the host <html> element. */
  readonly theme?: Readonly<Record<string, string>>;
  readonly density?: SandboxDensity;
  readonly identity?: SandboxFrameIdentity;
  readonly minHeight?: number;
  readonly maxHeight?: number;
  /** Debounce for re-sending the component after edits. Default 250 ms. */
  readonly loadDebounceMs?: number;
  /** Tear the frame down when no heartbeat arrived for this long. Default 5000 ms. */
  readonly heartbeatTimeoutMs?: number;
}

type Latest = Pick<
  SandboxFrameProps,
  "source" | "props" | "componentKey" | "version" | "density" | "theme"
>;

/**
 * Host-side sandbox frame. Creates `<iframe sandbox="allow-scripts">` (never allow-same-origin, so the
 * frame has an opaque origin), validates every incoming message (origin "null", exact contentWindow,
 * strict parsers), forwards record requests to a capability-enforcing bridge, auto-sizes, re-sends the
 * component on change, and tears the frame down if it stalls or navigates.
 */
export function SandboxFrame(props: SandboxFrameProps): ReactElement {
  const {
    sandboxUrl = DEFAULT_SANDBOX_URL,
    minHeight = 0,
    maxHeight = 2_000,
    loadDebounceMs = 250,
    heartbeatTimeoutMs = 5_000,
  } = props;
  const [height, setHeight] = useState(minHeight);
  const [halted, setHalted] = useState<"stalled" | "navigated" | null>(null);
  const [generation, setGeneration] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Latest values are read through refs so parent re-renders never recreate the bridge.
  const latest = useRef<Latest>(props);
  latest.current = props;
  const onEventRef = useRef(props.onEvent);
  onEventRef.current = props.onEvent;
  const servicesRef = useRef(props.services);
  servicesRef.current = props.services;
  const sendLoadRef = useRef<(() => void) | null>(null);

  const capabilitiesKey = JSON.stringify(props.capabilities);
  const grants = useMemo(
    () => grantsFromComponentCapabilities(JSON.parse(capabilitiesKey) as ComponentCapability[]),
    [capabilitiesKey],
  );
  const identity = props.identity;

  // Bridge + message pipeline: rebuilt only when the frame identity or capabilities change.
  useEffect(() => {
    const iframe = iframeRef.current;
    const frameWindow = iframe?.contentWindow;
    if (!iframe || !frameWindow || halted) return;

    const emit = (event: SandboxFrameEvent): void => onEventRef.current?.(event);
    const scope: PluginSecurityScope = {
      tenantId: identity?.tenantId ?? "current",
      installationId: "sandbox",
      actorUserId: identity?.actorUserId ?? null,
      actorPositionId: identity?.actorPositionId ?? null,
      grants,
      authorizationRevision: identity?.authorizationRevision ?? 0,
      expiresAt: null,
    };
    // Services are re-read on every call so inline objects from the parent stay current.
    const services: HostBridgeServices = {
      getRecord: (s, sel) => servicesRef.current.getRecord(s, sel),
      updateRecord: (s, sel, values, version) =>
        servicesRef.current.updateRecord(s, sel, values, version),
      subscribe: (s, sel, emitRecord) => servicesRef.current.subscribe(s, sel, emitRecord),
    };
    const bridge: HostBridge = createHostBridge({
      manifest: {
        id: latest.current.componentKey,
        version: String(latest.current.version),
        apiVersion: "1.0",
        displayName: props.title,
        iframeEntry: null,
        serverEntry: null,
        requestedCapabilities: [],
        requestedEgressOrigins: [],
      },
      scope,
      expectedPluginOrigin: "null",
      pluginWindow: frameWindow,
      hostWindow: window,
      services,
      maximumMessageBytes: 256 * 1024,
    });
    void bridge.start().catch(() => undefined);

    let booted = false;
    let lastBeat = Date.now();
    let loadCount = 0;
    let disposed = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const sendLoad = (): void => {
      const cur = latest.current;
      const theme = cur.theme ?? resolveThemeTokens();
      const message: SandboxLoadMessage = {
        kind: "sandbox.load",
        sessionId: bridge.sessionId,
        handshakeNonce: bridge.handshakeNonce,
        componentKey: cur.componentKey,
        version: cur.version,
        source: cur.source,
        props: cur.props,
        theme,
        density: cur.density ?? "comfortable",
        grantedCapabilities: [...new Set(grants.map((g) => g.capability))],
      };
      try {
        // Same validation the frame applies: fail early with a readable host-side error.
        parseSandboxLoadMessage(JSON.parse(JSON.stringify(message)));
        frameWindow.postMessage(message, "*");
      } catch (error: unknown) {
        emit({
          type: "error",
          phase: "load",
          message:
            error instanceof ProtocolError
              ? "Component source or props are too large or invalid."
              : "Could not send component.",
          line: null,
          column: null,
        });
      }
    };
    sendLoadRef.current = sendLoad;

    const teardown = (reason: "stalled" | "navigated"): void => {
      if (disposed) return;
      disposed = true;
      void bridge.dispose("error");
      emit({ type: reason });
      setHalted(reason);
    };

    const onMessage = (event: MessageEvent<unknown>): void => {
      // 1. exact window, 2. opaque origin, 3. control-kind, 4. strict parser, 5. session id.
      if (event.source !== frameWindow || event.origin !== "null") return;
      if (!isSandboxControlKind(event.data)) return; // record traffic belongs to the bridge listener
      let message: ReturnType<typeof parseSandboxToHostMessage>;
      try {
        message = parseSandboxToHostMessage(event.data);
      } catch {
        return;
      }
      if (message.kind === "sandbox.boot") {
        booted = true;
        lastBeat = Date.now();
        sendLoad();
        return;
      }
      if (message.sessionId !== bridge.sessionId) return;
      switch (message.kind) {
        case "sandbox.heartbeat":
          lastBeat = Date.now();
          break;
        case "sandbox.ready":
          emit({ type: "ready", version: message.version });
          break;
        case "sandbox.render-error":
          emit({
            type: "error",
            phase: message.phase,
            message: message.message,
            line: message.line,
            column: message.column,
          });
          break;
        case "sandbox.console":
          emit({ type: "console", level: message.level, args: message.args });
          break;
        case "sandbox.resize": {
          const next = clampSandboxHeight(message.height, minHeight, maxHeight);
          setHeight(next);
          emit({ type: "resize", height: next });
          break;
        }
      }
    };
    window.addEventListener("message", onMessage);

    // A document in the frame may navigate itself; a second load means it is no longer our page.
    const onFrameLoad = (): void => {
      loadCount += 1;
      if (loadCount > 1) teardown("navigated");
    };
    iframe.addEventListener("load", onFrameLoad);

    // Watchdog: a frame that stops heartbeating (infinite loop) is removed from the DOM.
    const watchdog = setInterval(() => {
      if (booted && Date.now() - lastBeat > heartbeatTimeoutMs) teardown("stalled");
    }, 1_000);

    // Re-send theme when the host theme changes (class/style/data attributes on <html>).
    const observer = new MutationObserver(() => {
      if (!booted || latest.current.theme) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(sendLoad, 50);
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      disposed = true;
      sendLoadRef.current = null;
      if (debounce) clearTimeout(debounce);
      clearInterval(watchdog);
      observer.disconnect();
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onFrameLoad);
      void bridge.dispose("navigation");
    };
  }, [generation, capabilitiesKey, props.componentKey, sandboxUrl, halted]);

  // Re-send the component (debounced) when source, props, theme, density or version change.
  const propsKey = safeStringify(props.props);
  useEffect(() => {
    const timer = setTimeout(() => sendLoadRef.current?.(), loadDebounceMs);
    return () => clearTimeout(timer);
  }, [props.source, propsKey, props.version, props.density, props.theme, loadDebounceMs]);

  if (halted) {
    return h(
      "div",
      { role: "alert", className: props.className },
      halted === "stalled"
        ? "This component stopped responding and was stopped."
        : "This component tried to navigate away and was stopped.",
      " ",
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            setHalted(null);
            setGeneration((g) => g + 1);
          },
        },
        "Reload component",
      ),
    );
  }

  return h("iframe", {
    key: `${generation}:${props.componentKey}:${capabilitiesKey}:${sandboxUrl}`,
    ref: iframeRef,
    src: sandboxUrl,
    title: props.title,
    // allow-scripts only: no allow-same-origin (opaque origin), no top-navigation, forms, popups or modals.
    sandbox: "allow-scripts",
    allow: "",
    referrerPolicy: "no-referrer",
    className: props.className,
    style: { width: "100%", height, border: 0, display: "block", colorScheme: "normal" },
  });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}
