import type { StudioGetOutput } from "@argus/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createStudioStub,
  type StudioPort,
  StudioServicesProvider,
} from "../../services/studio.js";
import { BoardsEnvironmentProvider, createDisconnectedBoardsEnvironment } from "../boards/index.js";
import {
  type PageLoadState,
  PageRuntimeScreen,
  PageRuntimeView,
  pageBySlugKey,
} from "./page-runtime.js";
import { makePageFixture } from "./test-fixtures.js";

const scope = {
  tenantId: "a1000000-0000-4000-8000-0000000000a1",
  userId: "a1000000-0000-4000-8000-0000000000d1",
  positionId: "a1000000-0000-4000-8000-0000000000e1",
  incidentId: null,
  requestId: "a1000000-0000-4000-8000-0000000000f1",
  authenticatedAt: "2026-11-19T00:00:00.000Z",
};

function publishedOutput(): StudioGetOutput {
  const page = makePageFixture();
  return {
    summary: {
      id: page.id,
      kind: "page",
      key: page.key,
      name: page.title,
      description: page.description,
      slug: page.slug,
      publishedVersion: page.version,
      draftVersion: null,
      hasUnpublishedChanges: false,
      updatedAt: page.createdAt,
      updatedBy: page.createdBy,
      publishedAt: page.publishedAt,
      permissions: { view: true, edit: true, publish: true, editCode: true },
    },
    version: page.version,
    document: { kind: "page", definition: page },
  };
}

/** Resolves the slug query through a fake StudioPort first, because SSR never runs effects. */
async function render(slug: string, studio: StudioPort, withScope = true): Promise<string> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await client.prefetchQuery({
    queryKey: pageBySlugKey(slug),
    queryFn: () => studio.getPageBySlug({ slug }),
  });
  const environment = {
    ...createDisconnectedBoardsEnvironment(),
    ...(withScope ? { scope } : {}),
  };
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <StudioServicesProvider studio={studio}>
        <BoardsEnvironmentProvider environment={environment}>
          <PageRuntimeView slug={slug} />
        </BoardsEnvironmentProvider>
      </StudioServicesProvider>
    </QueryClientProvider>,
  );
}

function renderState(state: PageLoadState): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <PageRuntimeScreen state={state} />
    </QueryClientProvider>,
  );
}

describe("PageRuntimeView", () => {
  it("shows a loading skeleton before the query resolves", () => {
    const client = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <PageRuntimeView slug="fixture-page" />
      </QueryClientProvider>,
    );
    expect(html).toContain("Loading page");
    expect(html).toContain('aria-busy="true"');
  });

  it("renders the published page title as the single h1, with its description", async () => {
    const studio = { ...createStudioStub(), getPageBySlug: async () => publishedOutput() };
    const html = await render("fixture-page", studio);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Fixture page");
    expect(html).toContain("Fictional page used by tests.");
    expect(html).toContain("Fictional fixture text.");
  });

  it("does not offer Edit page outside dev mode", async () => {
    const studio = { ...createStudioStub(), getPageBySlug: async () => publishedOutput() };
    expect(await render("fixture-page", studio)).not.toContain("Edit page");
  });

  it("renders a neutral not-found state when the page is missing or hidden", async () => {
    const studio = { ...createStudioStub(), getPageBySlug: async () => null };
    const html = await render("nope", studio);
    expect(html).toContain("Page not found");
    expect(html).not.toMatch(/permission|forbidden|exists but/i);
  });

  it("renders the not-connected state for the disconnected stub error", () => {
    const html = renderState({
      status: "error",
      error: new Error("TODO(implementation): StudioPort.getPageBySlug"),
      onRetry: () => undefined,
      retrying: false,
    });
    expect(html).toContain("Pages aren&#x27;t connected yet");
    expect(html).not.toContain("Try again");
  });

  it("renders an error with retry for other failures", () => {
    const html = renderState({
      status: "error",
      error: new Error("network down"),
      onRetry: () => undefined,
      retrying: false,
    });
    expect(html).toContain("Couldn&#x27;t load this page");
    expect(html).toContain("Try again");
  });

  it("does not render blocks without a session scope", async () => {
    const studio = { ...createStudioStub(), getPageBySlug: async () => publishedOutput() };
    const html = await render("fixture-page", studio, false);
    expect(html).toContain("Pages aren&#x27;t connected yet");
    expect(html).not.toContain("Fictional fixture text.");
  });
});
