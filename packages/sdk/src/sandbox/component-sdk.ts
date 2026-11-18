import {
  type CSSProperties,
  createElement as h,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type ArgusPluginClient,
  HostRequestError,
  type PluginSubscription,
} from "../client/create-client.js";
import type { HostRecord } from "../protocol/messages.js";

/** Runtime-provided state shared with hooks. One instance per iframe. */
export interface ComponentRuntimeStore {
  subscribe(listener: () => void): () => void;
  getProps(): Readonly<Record<string, unknown>>;
  getTheme(): ComponentTheme;
}

export interface ComponentTheme {
  /** Resolved `--argus-*` CSS variable values keyed by variable name. */
  readonly tokens: Readonly<Record<string, string>>;
  readonly density: "compact" | "comfortable";
}

export interface ComponentSdkEnvironment {
  readonly store: ComponentRuntimeStore;
  /** Resolves once the host handshake succeeded; rejects when it failed. */
  getClient(): Promise<ArgusPluginClient>;
}

export interface DataError {
  /** Host error code, e.g. "capability-denied", "not-found", "version-conflict", or "unavailable". */
  readonly code: string;
  readonly message: string;
}

export interface RecordsQuery {
  readonly tableId: string;
  readonly incidentId?: string | null;
  readonly viewId?: string | null;
  /** Client-side cap on the number of returned records. */
  readonly limit?: number;
}

export interface DataState<T> {
  /** "idle" means the query was null (nothing requested yet). */
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly loading: boolean;
  readonly error: DataError | null;
  readonly data: T;
}

export interface RecordTarget {
  readonly tableId: string;
  readonly recordId: string;
  readonly incidentId?: string | null;
}

function toDataError(error: unknown): DataError {
  if (error instanceof HostRequestError) return { code: error.code, message: error.message };
  return { code: "unavailable", message: "The data service is unavailable." };
}

type Style = CSSProperties;
const v = (name: string, fallback: string): string => `var(--argus-${name}, ${fallback})`;

const TONE_COLOR = {
  default: v("color-fg", "inherit"),
  muted: v("color-fg-muted", "#6b7280"),
  subtle: v("color-fg-subtle", "#9ca3af"),
  critical: v("color-critical", "#dc2626"),
  warning: v("color-warning", "#b45309"),
  success: v("color-success", "#15803d"),
  info: v("color-info", "#1d4ed8"),
} as const;
export type Tone = keyof typeof TONE_COLOR;

export interface StackProps {
  readonly direction?: "row" | "column";
  readonly gap?: number | string;
  readonly align?: CSSProperties["alignItems"];
  readonly justify?: CSSProperties["justifyContent"];
  readonly wrap?: boolean;
  readonly children?: ReactNode;
}
export interface TextProps {
  readonly tone?: Tone;
  readonly size?: "sm" | "md" | "lg";
  readonly weight?: "normal" | "medium" | "bold";
  readonly mono?: boolean;
  readonly children?: ReactNode;
}
export interface HeadingProps {
  readonly level?: 1 | 2 | 3 | 4;
  readonly children?: ReactNode;
}
export interface CardProps {
  readonly padding?: number | string;
  readonly children?: ReactNode;
}
export interface ButtonProps {
  readonly variant?: "primary" | "secondary" | "danger";
  readonly disabled?: boolean;
  readonly type?: "button" | "submit";
  readonly onClick?: () => void;
  readonly children?: ReactNode;
}
export interface BadgeProps {
  readonly tone?: Tone;
  readonly children?: ReactNode;
}
export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
}

const gapOf = (gap: number | string | undefined): string =>
  typeof gap === "number" ? `${gap * 4}px` : (gap ?? v("gap", "8px"));

export function Stack(props: StackProps): ReactElement {
  const style: Style = {
    display: "flex",
    flexDirection: props.direction ?? "column",
    gap: gapOf(props.gap),
    flexWrap: props.wrap ? "wrap" : "nowrap",
    ...(props.align ? { alignItems: props.align } : {}),
    ...(props.justify ? { justifyContent: props.justify } : {}),
  };
  return h("div", { style }, props.children);
}

export function Text(props: TextProps): ReactElement {
  const size = { sm: "0.8125rem", md: "0.875rem", lg: "1rem" }[props.size ?? "md"];
  const weight = { normal: 400, medium: 500, bold: 700 }[props.weight ?? "normal"];
  const style: Style = {
    margin: 0,
    fontSize: size,
    fontWeight: weight,
    color: TONE_COLOR[props.tone ?? "default"],
    ...(props.mono ? { fontFamily: v("font-mono", "ui-monospace, monospace") } : {}),
  };
  return h("span", { style }, props.children);
}

export function Heading(props: HeadingProps): ReactElement {
  const level = props.level ?? 2;
  const size = { 1: "1.5rem", 2: "1.25rem", 3: "1.0625rem", 4: "0.9375rem" }[level];
  return h(
    `h${level}`,
    { style: { margin: 0, fontSize: size, fontWeight: 600, color: v("color-fg", "inherit") } },
    props.children,
  );
}

export function Card(props: CardProps): ReactElement {
  const pad =
    typeof props.padding === "number"
      ? `${props.padding * 4}px`
      : (props.padding ?? v("panel-p", "16px"));
  return h(
    "div",
    {
      style: {
        background: v("color-surface", "#fff"),
        border: `1px solid ${v("color-border", "#e5e7eb")}`,
        borderRadius: v("radius-md", "8px"),
        padding: pad,
      },
    },
    props.children,
  );
}

export function Button(props: ButtonProps): ReactElement {
  const variant = props.variant ?? "secondary";
  const palette = {
    primary: {
      bg: v("color-accent", "#2563eb"),
      fg: v("color-on-accent", "#fff"),
      border: v("color-accent", "#2563eb"),
    },
    secondary: {
      bg: v("color-surface", "#fff"),
      fg: v("color-fg", "#111"),
      border: v("color-border-strong", "#d1d5db"),
    },
    danger: {
      bg: v("color-critical-solid", "#dc2626"),
      fg: v("color-on-accent", "#fff"),
      border: v("color-critical-solid", "#dc2626"),
    },
  }[variant];
  return h(
    "button",
    {
      type: props.type ?? "button",
      disabled: props.disabled ?? false,
      onClick: props.onClick,
      style: {
        minHeight: v("control-h", "32px"),
        padding: `0 ${v("control-px", "12px")}`,
        borderRadius: v("radius-md", "6px"),
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.fg,
        font: "inherit",
        fontWeight: 500,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
      },
    },
    props.children,
  );
}

export function Badge(props: BadgeProps): ReactElement {
  const tone = props.tone ?? "default";
  return h(
    "span",
    {
      style: {
        display: "inline-block",
        padding: "0 8px",
        borderRadius: "999px",
        border: `1px solid ${TONE_COLOR[tone]}`,
        color: TONE_COLOR[tone],
        fontSize: "0.75rem",
        lineHeight: "1.25rem",
        fontWeight: 500,
      },
    },
    props.children,
  );
}

/** Neutral placeholder shown when there is nothing to display; never fabricates data. */
export function EmptyState(props: EmptyStateProps): ReactElement {
  return h(
    "div",
    {
      role: "status",
      style: { textAlign: "center", padding: "16px", color: v("color-fg-muted", "#6b7280") },
    },
    h("div", { style: { fontWeight: 600, color: v("color-fg", "inherit") } }, props.title),
    props.description
      ? h("div", { style: { fontSize: "0.875rem", marginTop: "4px" } }, props.description)
      : null,
  );
}

/** Build the `@argus/component-sdk` module object for one runtime. */
export function createComponentSdk(env: ComponentSdkEnvironment) {
  function useProps<T extends Record<string, unknown> = Record<string, unknown>>(): T {
    return useSyncExternalStore(env.store.subscribe, env.store.getProps) as T;
  }

  function useTheme(): ComponentTheme {
    return useSyncExternalStore(env.store.subscribe, env.store.getTheme);
  }

  /** Live records of a table (or view) through a host subscription. */
  function useRecords(query: RecordsQuery | null): DataState<readonly HostRecord[]> {
    const key = JSON.stringify(
      query
        ? [query.tableId, query.incidentId ?? null, query.viewId ?? null, query.limit ?? null]
        : null,
    );
    const [state, setState] = useState<DataState<readonly HostRecord[]>>(
      query
        ? { status: "loading", loading: true, error: null, data: [] }
        : { status: "idle", loading: false, error: null, data: [] },
    );
    useEffect(() => {
      if (!query?.tableId) {
        setState({ status: "idle", loading: false, error: null, data: [] });
        return;
      }
      let cancelled = false;
      let subscription: PluginSubscription | null = null;
      const records = new Map<string, HostRecord>();
      const publish = (): void => {
        const all = [...records.values()];
        setState({
          status: "ready",
          loading: false,
          error: null,
          data: query.limit === undefined ? all : all.slice(0, query.limit),
        });
      };
      setState({ status: "loading", loading: true, error: null, data: [] });
      env
        .getClient()
        .then((client) =>
          client.subscribe(
            {
              incidentId: query.incidentId ?? null,
              tableId: query.tableId,
              viewId: query.viewId ?? null,
            },
            (record) => {
              if (cancelled) return;
              records.set(record.id, record);
              publish();
            },
          ),
        )
        .then((sub) => {
          if (cancelled) {
            void sub.close();
            return;
          }
          subscription = sub;
          publish();
        })
        .catch((error: unknown) => {
          if (!cancelled)
            setState({ status: "error", loading: false, error: toDataError(error), data: [] });
        });
      return () => {
        cancelled = true;
        void subscription?.close();
      };
    }, [key]);
    return state;
  }

  /** One record, fetched through the bridge; `refresh` re-reads it. */
  function useRecord(
    tableId: string | null | undefined,
    recordId: string | null | undefined,
    incidentId: string | null = null,
  ): DataState<HostRecord | null> & { readonly refresh: () => void } {
    const [tick, setTick] = useState(0);
    const [state, setState] = useState<DataState<HostRecord | null>>({
      status: "idle",
      loading: false,
      error: null,
      data: null,
    });
    useEffect(() => {
      if (!tableId || !recordId) {
        setState({ status: "idle", loading: false, error: null, data: null });
        return;
      }
      const controller = new AbortController();
      setState((prev) => ({ ...prev, status: "loading", loading: true, error: null }));
      env
        .getClient()
        .then((client) => client.getRecord({ incidentId, tableId, recordId }, controller.signal))
        .then((record) => setState({ status: "ready", loading: false, error: null, data: record }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setState({ status: "error", loading: false, error: toDataError(error), data: null });
          }
        });
      return () => controller.abort();
    }, [tableId, recordId, incidentId, tick]);
    return { ...state, refresh: () => setTick((t) => t + 1) };
  }

  /** Patch granted fields with optimistic concurrency. Rejects with a `DataError`-shaped object. */
  async function updateRecord(
    target: RecordTarget,
    values: Readonly<Record<string, unknown>>,
    expectedVersion: number,
  ): Promise<HostRecord> {
    try {
      const client = await env.getClient();
      return await client.updateRecord(
        {
          incidentId: target.incidentId ?? null,
          tableId: target.tableId,
          recordId: target.recordId,
        },
        values,
        expectedVersion,
      );
    } catch (error: unknown) {
      throw toDataError(error);
    }
  }

  return {
    useProps,
    useTheme,
    useRecords,
    useRecord,
    updateRecord,
    Stack,
    Text,
    Heading,
    Card,
    Button,
    Badge,
    EmptyState,
  };
}

export type ComponentSdk = ReturnType<typeof createComponentSdk>;
