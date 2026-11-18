import { type BlockRenderContext, coreBlockRegistry } from "@argus/blocks";
import type { PageDefinition, StudioGetOutput } from "@argus/schema";
import {
  Button,
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  SkeletonGroup,
  SkeletonText,
} from "@argus/ui";
import { Code2, FileSearch, Pencil } from "@argus/ui/icons";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useMemo } from "react";
import { useStudioPort } from "../../services/studio.js";
import { BoardGrid, type LayoutBreakpoint, useBoardsEnvironment } from "../boards/index.js";
import { useDevMode } from "../studio/dev-mode.js";
import { isNotConnected } from "../studio/studio-index-page.js";
import { builderHref } from "../studio/studio-links.js";
import { pageToBundle } from "./page-bundle.js";
import { PageIcon } from "./page-icon.js";

export const pageBySlugKey = (slug: string) => ["studio", "page-by-slug", slug] as const;

/** Loads the published page for `/p/<slug>`; resolves null when missing or not visible. */
export function usePublishedPageBySlug(slug: string) {
  const studio = useStudioPort();
  return useQuery({
    queryKey: pageBySlugKey(slug),
    queryFn: () => studio.getPageBySlug({ slug }),
    retry: (count, error) => !isNotConnected(error) && count < 2,
  });
}

/** Narrows a studio document to a page definition (anything else is a contract violation). */
export function pageOf(output: StudioGetOutput): PageDefinition | null {
  return output.document.kind === "page" ? output.document.definition : null;
}

/**
 * Renders a page's blocks with the shared board grid. The page is adapted to the board shape
 * (see page-bundle.ts); security scope and the live data port come from the boards environment.
 * Blocks still enforce their own authorization; `access` only narrows who sees the page.
 */
export function PageBlocks({
  page,
  mode = "runtime",
  breakpoint,
}: {
  readonly page: PageDefinition;
  readonly mode?: BlockRenderContext["mode"];
  readonly breakpoint?: LayoutBreakpoint;
}): ReactElement {
  const { scope, data } = useBoardsEnvironment();
  const bundle = useMemo(() => pageToBundle(page), [page]);
  const context = useMemo<BlockRenderContext | null>(
    () => (scope ? { scope, boardId: page.id, definitionVersion: page.version, mode } : null),
    [scope, page.id, page.version, mode],
  );
  if (!context) return <NoSessionState />;
  return (
    <BoardGrid
      definition={bundle.definition}
      layout={bundle.layout}
      registry={coreBlockRegistry}
      context={context}
      data={data}
      {...(breakpoint ? { breakpoint } : {})}
    />
  );
}

function NoSessionState(): ReactElement {
  return (
    <EmptyState
      icon={<Code2 />}
      title="Pages aren't connected yet"
      description="There's no signed-in session to load page data for in this build, so nothing is shown rather than invented data."
    />
  );
}

function LoadingPage(): ReactElement {
  return (
    <SkeletonGroup label="Loading page" className="grid gap-3">
      <SkeletonText lines={2} />
      <SkeletonText lines={4} />
    </SkeletonGroup>
  );
}

/** Load state of the slug query, as the screen needs it (lets tests render every state). */
export type PageLoadState =
  | { readonly status: "pending" }
  | {
      readonly status: "error";
      readonly error: unknown;
      readonly onRetry: () => void;
      readonly retrying: boolean;
    }
  | { readonly status: "success"; readonly data: StudioGetOutput | null };

/** Runtime view for a slug: loads the published page and renders it. */
export function PageRuntimeView({ slug }: { readonly slug: string }): ReactElement {
  const query = usePublishedPageBySlug(slug);
  const state: PageLoadState = query.isPending
    ? { status: "pending" }
    : query.isError
      ? {
          status: "error",
          error: query.error,
          onRetry: () => void query.refetch(),
          retrying: query.isFetching,
        }
      : { status: "success", data: query.data ?? null };
  return <PageRuntimeScreen state={state} />;
}

/** Presentational runtime screen: skeleton, not-connected, error, not-found or the page itself. */
export function PageRuntimeScreen({ state }: { readonly state: PageLoadState }): ReactElement {
  const { enabled } = useDevMode();
  const output = state.status === "success" ? state.data : null;
  const page = output ? pageOf(output) : null;
  const canEdit = enabled && output?.summary.permissions.edit === true;

  let body: ReactElement;
  let title = "Page";
  if (state.status === "pending") {
    body = <LoadingPage />;
  } else if (state.status === "error") {
    body = isNotConnected(state.error) ? (
      <EmptyState
        icon={<Code2 />}
        title="Pages aren't connected yet"
        description="Published pages are served by the API, which isn't connected in this build."
      />
    ) : (
      <ErrorState
        title="Couldn't load this page"
        description="The request failed. Check your connection and try again."
        onRetry={state.onRetry}
        retrying={state.retrying}
      />
    );
  } else if (output === null) {
    body = (
      <EmptyState
        size="page"
        icon={<FileSearch />}
        title="Page not found"
        description="This page isn't available. Check the link, or open the menu to find what you need."
      />
    );
  } else if (page === null) {
    body = (
      <ErrorState
        title="Couldn't show this page"
        description="The server returned a different kind of document than a page."
      />
    );
  } else {
    title = page.title;
    body = <PageBlocks page={page} />;
  }

  return (
    <PageContainer width="full">
      <PageHeader
        title={title}
        {...(page?.description ? { description: page.description } : {})}
        {...(page
          ? {
              eyebrow: (
                <span className="inline-flex items-center gap-1.5">
                  <PageIcon name={page.icon} />
                  Page
                </span>
              ),
            }
          : {})}
        {...(canEdit && output
          ? {
              actions: (
                <Button asChild leadingIcon={<Pencil />}>
                  <Link to={builderHref("page", output.summary.id)}>Edit page</Link>
                </Button>
              ),
            }
          : {})}
      />
      <section aria-label={page ? `${page.title} content` : "Page content"}>{body}</section>
    </PageContainer>
  );
}

/** `/p/$slug` — renders a published user-built page (blocks on the shared 12-column grid). */
export function PageRuntimePage(): ReactElement {
  const params = useParams({ strict: false });
  const slug = typeof params.slug === "string" ? params.slug : "";
  return <PageRuntimeView slug={slug} />;
}
