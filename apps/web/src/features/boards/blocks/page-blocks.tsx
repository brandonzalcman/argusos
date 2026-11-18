import { coreBlockRegistry } from "@argus/blocks";
import type { StudioGetOutput } from "@argus/schema";
import { type HostBridgeServices, SandboxFrame, type SandboxFrameEvent } from "@argus/sdk/host";
import { Skeleton, SkeletonGroup, EmptyState as UiEmptyState, useUIPreferences } from "@argus/ui";
import {
  ArrowRight,
  ExternalLink,
  FileText,
  LayoutGrid,
  Link2,
  type LucideIcon,
  Map as MapIcon,
  Megaphone,
  Newspaper,
  Siren,
} from "@argus/ui/icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useMemo, useState } from "react";
import { useStudioPort } from "../../../services/studio.js";
import { BoardGrid } from "../board-renderer.js";
import { useBoardsEnvironment } from "../environment.js";
import type { BoardDefinition } from "../model.js";
import { isNotImplementedError } from "../queries.js";
import { EmptyState, ErrorState } from "../states.js";
import type { BlockViewProps } from "./block-view.js";
import {
  componentAvailability,
  mergeComponentProps,
  readComponentConfig,
} from "./component-model.js";
import { checkEmbed, EmbedChainProvider, useEmbedChain } from "./embed-model.js";
import { type LinkItem, readLinkList, resolveLinkTarget } from "./link-model.js";

/** TODO(implementation): full icon picker over the whole Lucide set; unknown names use Link2. */
const knownIcons: Readonly<Record<string, LucideIcon>> = {
  "arrow-right": ArrowRight,
  "external-link": ExternalLink,
  "file-text": FileText,
  "layout-grid": LayoutGrid,
  link: Link2,
  map: MapIcon,
  megaphone: Megaphone,
  newspaper: Newspaper,
  siren: Siren,
};

const linkClass =
  "inline-flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-fg no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus";

function PageLink({
  pageId,
  children,
}: {
  readonly pageId: string;
  readonly children: ReactElement;
}): ReactElement {
  const studio = useStudioPort();
  const query = useQuery({
    queryKey: ["boards", "link-list", "page-slug", pageId],
    queryFn: () => studio.get({ kind: "page", id: pageId, revision: "published" }),
    retry: false,
  });
  const document = query.data?.document;
  const slug = document?.kind === "page" ? document.definition.slug : null;
  if (!slug) {
    return (
      <span className={`${linkClass} text-fg-muted`} aria-disabled="true">
        {query.isPending ? "Loading…" : "Page unavailable"}
      </span>
    );
  }
  return (
    <Link to="/p/$slug" params={{ slug }} className={linkClass}>
      {children}
    </Link>
  );
}

function LinkRow({ link }: { readonly link: LinkItem }): ReactElement {
  const resolved = resolveLinkTarget(link.target);
  const Icon = (link.icon ? knownIcons[link.icon] : undefined) ?? Link2;
  const content = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      <span className="truncate" title={link.label}>
        {link.label}
      </span>
    </>
  );
  switch (resolved.kind) {
    case "board":
      return (
        <Link to="/boards/$boardId" params={{ boardId: resolved.boardId }} className={linkClass}>
          {content}
        </Link>
      );
    case "page":
      return <PageLink pageId={resolved.pageId}>{content}</PageLink>;
    case "external":
      return (
        <a href={resolved.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {content}
          <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-fg-muted" />
          <span className="boards-visually-hidden"> (opens in a new tab)</span>
        </a>
      );
    case "unavailable":
      return (
        <span className={`${linkClass} text-fg-muted`} aria-disabled="true">
          {content}
        </span>
      );
  }
}

export function LinkListBody({ props }: { readonly props: BlockViewProps }): ReactElement {
  const model = readLinkList(props.block.config);
  if (model.links.length === 0) return <EmptyState title="No links yet" />;
  return (
    <nav aria-label={model.title ?? props.block.name}>
      {model.title ? <p className="m-0 mb-1 text-sm font-semibold">{model.title}</p> : null}
      <ul
        className={
          model.layout === "grid"
            ? "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1 p-0"
            : "m-0 grid list-none gap-0.5 p-0"
        }
      >
        {model.links.map((link, index) => (
          <li key={`${index}-${link.label}`} className="min-w-0">
            <LinkRow link={link} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BodySkeleton({ label }: { readonly label: string }): ReactElement {
  return (
    <SkeletonGroup label={label} className="grid gap-2">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-16 w-full" />
    </SkeletonGroup>
  );
}

export function BoardEmbedBody({ props }: { readonly props: BlockViewProps }): ReactElement {
  const { scope, repository } = useBoardsEnvironment();
  const chain = useEmbedChain();
  const { config } = props.block;
  const boardId = typeof config.boardId === "string" ? config.boardId : "";
  const showHeader = config.showHeader === true;
  const ancestors = useMemo(
    () => (chain.length === 0 ? [props.context.boardId] : chain),
    [chain, props.context.boardId],
  );
  const check = checkEmbed(ancestors, boardId);
  const query = useQuery({
    queryKey: [
      "boards",
      "embed",
      scope?.tenantId ?? null,
      scope?.incidentId ?? null,
      scope?.positionId ?? null,
      boardId,
    ],
    enabled: scope !== null && check === "ok" && boardId !== "",
    retry: (count, error) => !isNotImplementedError(error) && count < 1,
    queryFn: () => {
      if (!scope) throw new Error("No session scope");
      return repository.getPublished(scope, boardId);
    },
  });

  if (check === "cycle") {
    return (
      <UiEmptyState
        size="inline"
        title="Board can't embed itself"
        description="This embed points back to a board that is already being shown."
      />
    );
  }
  if (check === "too-deep") {
    return (
      <UiEmptyState
        size="inline"
        title="Embedded boards are nested too deeply"
        description="Open the board directly to see it."
      />
    );
  }
  if (!scope) {
    return (
      <UiEmptyState
        size="inline"
        title="Not connected"
        description="No session scope is available, so the board is not loaded."
      />
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load the embedded board"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) return <BodySkeleton label={`Loading ${props.block.name}`} />;
  const bundle = query.data;
  const definition: BoardDefinition = bundle.definition;
  return (
    <div className="grid gap-2">
      {showHeader ? (
        <div className="flex items-center justify-between gap-2">
          <strong className="truncate" title={definition.name}>
            {definition.name}
          </strong>
          <Link
            to="/boards/$boardId"
            params={{ boardId }}
            className="inline-flex shrink-0 items-center gap-1 text-sm"
          >
            Open board
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      ) : null}
      <EmbedChainProvider value={[...ancestors, boardId]}>
        <BoardGrid
          definition={definition}
          layout={bundle.layout}
          registry={coreBlockRegistry}
          context={{
            scope,
            boardId: definition.id,
            definitionVersion: definition.version,
            mode: props.context.mode,
          }}
          data={props.data}
        />
      </EmbedChainProvider>
    </div>
  );
}

export const NOT_CONNECTED_MESSAGE = "Data isn't connected for custom components yet.";

/**
 * Host services for custom components in blocks.
 *
 * TODO(implementation): read through a scoped record-level data port (ElectricSQL live query).
 * Input: tenant/incident/position scope + table, record and field selectors.
 * Output: authorized, field-redacted records.
 * Errors: reject with the safe "not connected" message until then.
 * Depends on: a record-level data port; mirrors features/studio/components/preview-panel.tsx.
 */
export function createBlockServices(): HostBridgeServices {
  const reject = async (): Promise<never> => {
    throw new Error(NOT_CONNECTED_MESSAGE);
  };
  return { getRecord: reject, updateRecord: reject, subscribe: reject };
}

function ComponentView({
  output,
  props,
}: {
  readonly output: StudioGetOutput;
  readonly props: BlockViewProps;
}): ReactElement {
  const { density } = useUIPreferences();
  const [event, setEvent] = useState<SandboxFrameEvent | null>(null);
  const services = useMemo(() => createBlockServices(), []);
  const document = output.document;
  const definition = document.kind === "component" ? document.definition : null;
  const config = readComponentConfig(props.block.config);
  const merged = useMemo(
    () => (definition && config ? mergeComponentProps(definition.props, config.props) : {}),
    [definition, config],
  );
  if (!definition || !config) {
    return <ErrorState title="Not a custom component" error={new Error("Unexpected document")} />;
  }
  if (componentAvailability(definition, props.context.mode) === "unpublished") {
    return (
      <UiEmptyState
        size="inline"
        title="This component version isn't published"
        description="Publish the pinned version, or pin a published one."
      />
    );
  }
  return (
    <div className="grid gap-2">
      {event?.type === "error" ? (
        <ErrorState title="This component reported an error" error={new Error(event.message)} />
      ) : null}
      {event?.type === "stalled" ? (
        <UiEmptyState size="inline" title="This component stopped responding" />
      ) : (
        <SandboxFrame
          title={definition.name}
          source={definition.source}
          props={merged}
          componentKey={definition.key}
          version={config.componentVersion}
          capabilities={definition.capabilities}
          services={services}
          density={density}
          minHeight={80}
          maxHeight={900}
          onEvent={setEvent}
        />
      )}
    </div>
  );
}

export function CustomComponentBody({ props }: { readonly props: BlockViewProps }): ReactElement {
  const studio = useStudioPort();
  const config = readComponentConfig(props.block.config);
  const query = useQuery({
    queryKey: ["boards", "custom-component", config?.componentId, config?.componentVersion],
    enabled: config !== null,
    retry: (count, error) => !isNotImplementedError(error) && count < 1,
    queryFn: () => {
      if (!config) throw new Error("Not configured");
      return studio.get({
        kind: "component",
        id: config.componentId,
        revision: config.componentVersion,
      });
    },
  });
  if (!config) return <EmptyState title="Not configured" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load the component"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) return <BodySkeleton label={`Loading ${props.block.name}`} />;
  if (query.data === null) {
    return (
      <UiEmptyState
        size="inline"
        title="Component not found"
        description="The pinned version may have been removed or is hidden from your position."
      />
    );
  }
  return <ComponentView output={query.data} props={props} />;
}
