import type { StudioApi } from "@argus/schema";
import { describe, expect, it } from "vitest";
import { createDemoSessionPort } from "../../demo/studio/session.js";
import { createDemoStudioPort } from "../../demo/studio/studio-port.js";
import { createAuthClient } from "./auth-client.js";
import { resolveApiBaseUrl } from "./config.js";
import { createApiServices } from "./index.js";
import { createSessionApiClient } from "./session-client.js";
import { createStudioApiClient } from "./studio-client.js";
import { createTrpcHttpClient, type FetchLike, isApiClientError } from "./trpc-http.js";

interface Recorded {
  url: string;
  init: RequestInit;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function recorder(respond: () => Response | Promise<Response>) {
  const calls: Recorded[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    return respond();
  };
  return { calls, fetch };
}

const BASE = "http://api.test";
const REQUEST_ID = "7f1d3a52-0000-4000-8000-0000000000aa";

describe("resolveApiBaseUrl", () => {
  it("defaults, trims trailing slashes, rejects non-http", () => {
    expect(resolveApiBaseUrl("")).toBe("http://localhost:3001");
    expect(resolveApiBaseUrl("https://api.example.org//")).toBe("https://api.example.org");
    expect(() => resolveApiBaseUrl("ftp://x")).toThrow();
    expect(() => resolveApiBaseUrl("not a url")).toThrow();
  });

  it("rejects credentials, query and hash but allows a proxy path prefix", () => {
    expect(() => resolveApiBaseUrl("https://user:pw@api.example.org")).toThrow();
    expect(() => resolveApiBaseUrl("https://user@api.example.org")).toThrow();
    expect(() => resolveApiBaseUrl("https://api.example.org?x=1")).toThrow();
    expect(() => resolveApiBaseUrl("https://api.example.org/#frag")).toThrow();
    expect(() => resolveApiBaseUrl("https://api.example.org/?")).toThrow();
    expect(resolveApiBaseUrl("https://example.org/argus-api/")).toBe(
      "https://example.org/argus-api",
    );
  });

  it("reads import.meta.env without an argument", () => {
    expect(resolveApiBaseUrl()).toMatch(/^https?:\/\//);
  });
});

describe("trpc http client", () => {
  it("encodes queries as GET with the input param and includes credentials", async () => {
    const { calls, fetch } = recorder(() => json({ result: { data: { ok: 1 } } }));
    const http = createTrpcHttpClient({ baseUrl: `${BASE}/`, fetch });
    const out = await http.query("studio.list", { kind: "board", cursor: null });
    expect(out).toEqual({ ok: 1 });
    const call = calls[0];
    expect(call?.init.method).toBe("GET");
    expect(call?.init.credentials).toBe("include");
    expect(call?.init.body).toBeUndefined();
    const url = new URL(call?.url ?? "");
    expect(url.origin + url.pathname).toBe("http://api.test/trpc/studio.list");
    expect(JSON.parse(url.searchParams.get("input") ?? "")).toEqual({
      kind: "board",
      cursor: null,
    });
  });

  it("omits the input param when undefined", async () => {
    const { calls, fetch } = recorder(() => json({ result: { data: null } }));
    await createTrpcHttpClient({ baseUrl: BASE, fetch }).query("session.get");
    expect(calls[0]?.url).toBe("http://api.test/trpc/session.get");
  });

  it("encodes mutations as JSON POST", async () => {
    const { calls, fetch } = recorder(() => json({ result: { data: 1 } }));
    await createTrpcHttpClient({ baseUrl: BASE, fetch }).mutation("studio.publish", { a: [1] });
    const call = calls[0];
    expect(call?.url).toBe("http://api.test/trpc/studio.publish");
    expect(call?.init.method).toBe("POST");
    expect(call?.init.credentials).toBe("include");
    expect(new Headers(call?.init.headers).get("content-type")).toBe("application/json");
    expect(call?.init.body).toBe(JSON.stringify({ a: [1] }));
  });

  it("maps a validated apiError including requestId and conflict code", async () => {
    const { fetch } = recorder(() =>
      json(
        {
          error: {
            message: "conflict",
            code: -32603,
            data: {
              code: "CONFLICT",
              httpStatus: 409,
              path: "studio.saveDraft",
              apiError: {
                code: "definition-version-conflict",
                message: "Draft moved",
                requestId: REQUEST_ID,
                retryable: false,
                fieldErrors: { baseVersion: ["stale"] },
                details: { currentVersion: 4 },
              },
            },
          },
        },
        409,
      ),
    );
    const http = createTrpcHttpClient({ baseUrl: BASE, fetch });
    const error = await http.mutation("studio.saveDraft", {}).catch((e: unknown) => e);
    expect(isApiClientError(error, "definition-version-conflict")).toBe(true);
    if (!isApiClientError(error)) throw new Error("unreachable");
    expect(error.requestId).toBe(REQUEST_ID);
    expect(error.httpStatus).toBe(409);
    expect(error.fieldErrors).toEqual({ baseVersion: ["stale"] });
    expect(error.details).toEqual({ currentVersion: 4 });
    expect(error.retryable).toBe(false);
  });

  it("falls back to the TRPC code when apiError is absent or invalid", async () => {
    const cases: [string, string][] = [
      ["UNAUTHORIZED", "unauthenticated"],
      ["FORBIDDEN", "forbidden"],
      ["NOT_FOUND", "not-found"],
      ["CONFLICT", "definition-version-conflict"],
      ["BAD_REQUEST", "validation-failed"],
      ["INTERNAL_SERVER_ERROR", "internal"],
    ];
    for (const [trpc, expected] of cases) {
      const { fetch } = recorder(() =>
        json(
          { error: { message: "m", code: -1, data: { code: trpc, apiError: { nope: 1 } } } },
          400,
        ),
      );
      const error = await createTrpcHttpClient({ baseUrl: BASE, fetch })
        .query("x.y")
        .catch((e: unknown) => e);
      expect(isApiClientError(error, expected as never)).toBe(true);
    }
  });

  it("maps a non-tRPC JSON 403 (origin guard) to forbidden", async () => {
    const guard = recorder(() => json({ error: "origin-not-allowed" }, 403));
    const error = await createTrpcHttpClient({ baseUrl: BASE, fetch: guard.fetch })
      .query("x.y")
      .catch((e: unknown) => e);
    expect(isApiClientError(error, "forbidden")).toBe(true);
    expect((error as { httpStatus: number | null }).httpStatus).toBe(403);
  });

  it("maps non-JSON 502 and network failures to retryable unavailable", async () => {
    const bad = recorder(() => new Response("<html>bad gateway</html>", { status: 502 }));
    const e1 = await createTrpcHttpClient({ baseUrl: BASE, fetch: bad.fetch })
      .query("x.y")
      .catch((e: unknown) => e);
    expect(isApiClientError(e1, "unavailable") && e1.retryable && e1.httpStatus === 502).toBe(true);

    const down: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    const e2 = await createTrpcHttpClient({ baseUrl: BASE, fetch: down })
      .query("x.y")
      .catch((e: unknown) => e);
    expect(isApiClientError(e2, "unavailable") && e2.retryable).toBe(true);
  });
});

/** Fake tRPC server that answers with an in-memory demo studio port. */
function fakeServer(studio: StudioApi, session = createDemoSessionPort(0)) {
  const calls: Recorded[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    const parsed = new URL(url);
    const [router, proc] = parsed.pathname.replace("/trpc/", "").split(".");
    const raw = init?.method === "POST" ? init.body : parsed.searchParams.get("input");
    const input = typeof raw === "string" ? JSON.parse(raw) : undefined;
    const target = (router === "studio" ? studio : session) as unknown as Record<
      string,
      (i: unknown) => Promise<unknown>
    >;
    const data = await target[proc ?? ""]?.(input);
    return json({ result: { data: data ?? null } });
  };
  return { calls, fetch };
}

describe("studio client", () => {
  it("maps each method 1:1 and validates outputs", async () => {
    const studio = createDemoStudioPort(createDemoSessionPort(0), { latencyMs: 0 });
    const { calls, fetch } = fakeServer(studio);
    const client = createStudioApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch }));
    const list = await client.list({ kind: "board", search: null, cursor: null, limit: 200 });
    expect(list.items.length).toBeGreaterThan(0);
    const first = list.items[0];
    if (!first) throw new Error("no boards");
    const got = await client.get({ kind: "board", id: first.id, revision: "published" });
    expect(got?.document.kind).toBe("board");
    const versions = await client.listVersions({ kind: "board", id: first.id });
    expect(versions.length).toBeGreaterThan(0);
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/trpc/studio.list",
      "/trpc/studio.get",
      "/trpc/studio.listVersions",
    ]);
  });

  it("throws internal on a contract mismatch", async () => {
    const { fetch } = recorder(() => json({ result: { data: { items: "nope" } } }));
    const client = createStudioApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch }));
    const error = await client
      .list({ kind: "board", search: null, cursor: null, limit: 1 })
      .catch((e: unknown) => e);
    expect(isApiClientError(error, "internal")).toBe(true);
    expect((error as Error).message).toBe("response did not match contract");
  });

  it("sends validate as a POST mutation with the document in the body, not the URL", async () => {
    const { calls, fetch } = recorder(() => json({ result: { data: { issues: [] } } }));
    const client = createStudioApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch }));
    await client.validate({ document: { kind: "page" } } as never);
    const call = calls[0];
    expect(call?.init.method).toBe("POST");
    expect(call?.url).toBe("http://api.test/trpc/studio.validate");
    expect(JSON.parse(String(call?.init.body))).toEqual({ document: { kind: "page" } });
  });

  it("returns null from get when the server returns null", async () => {
    const { fetch } = recorder(() => json({ result: { data: null } }));
    const client = createStudioApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch }));
    expect(
      await client.get({
        kind: "board",
        id: "7f1d3a52-0000-4000-8000-0000000000bb",
        revision: "draft",
      }),
    ).toBeNull();
  });
});

describe("session client", () => {
  it("returns a validated snapshot", async () => {
    const studio = createDemoStudioPort(createDemoSessionPort(0), { latencyMs: 0 });
    const { fetch } = fakeServer(studio);
    const client = createSessionApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch }));
    const snapshot = await client.get();
    expect(snapshot?.user.id).toBeTruthy();
  });

  it("returns null when the server says null or responds 401", async () => {
    const nullFetch = recorder(() => json({ result: { data: null } })).fetch;
    expect(
      await createSessionApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch: nullFetch })).get(),
    ).toBeNull();
    const unauth = recorder(() =>
      json({ error: { message: "no", code: -32001, data: { code: "UNAUTHORIZED" } } }, 401),
    ).fetch;
    expect(
      await createSessionApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch: unauth })).get(),
    ).toBeNull();
  });

  it("rethrows other errors and rejects mismatched snapshots", async () => {
    const down = recorder(() => new Response("x", { status: 503 })).fetch;
    await expect(
      createSessionApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch: down })).get(),
    ).rejects.toMatchObject({ code: "unavailable" });
    const bad = recorder(() => json({ result: { data: { user: 1 } } })).fetch;
    await expect(
      createSessionApiClient(createTrpcHttpClient({ baseUrl: BASE, fetch: bad })).get(),
    ).rejects.toMatchObject({ code: "internal" });
  });
});

describe("auth client", () => {
  it("posts credentials with cookies included", async () => {
    const { calls, fetch } = recorder(() => json({ ok: true }));
    const auth = createAuthClient({ baseUrl: `${BASE}/`, fetch });
    await auth.signInWithEmail("a@b.test", "pw");
    await auth.signOut();
    expect(calls[0]?.url).toBe("http://api.test/api/auth/sign-in/email");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.credentials).toBe("include");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ email: "a@b.test", password: "pw" });
    expect(calls[1]?.url).toBe("http://api.test/api/auth/sign-out");
  });

  it("maps failures without echoing credentials", async () => {
    const bad = recorder(() => json({ message: "Invalid email or password" }, 401)).fetch;
    const error = await createAuthClient({ baseUrl: BASE, fetch: bad })
      .signInWithEmail("a@b.test", "secret-pw")
      .catch((e: unknown) => e);
    expect(isApiClientError(error, "unauthenticated")).toBe(true);
    expect(String((error as Error).message)).not.toContain("secret-pw");
    const down = recorder(() => new Response("x", { status: 502 })).fetch;
    await expect(createAuthClient({ baseUrl: BASE, fetch: down }).signOut()).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});

describe("auth client status mapping", () => {
  it.each([
    [400, "validation-failed"],
    [422, "validation-failed"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [429, "rate-limited"],
  ] as const)("maps %i to %s", async (status, code) => {
    const { fetch } = recorder(() => json({ message: "nope" }, status));
    await expect(
      createAuthClient({ baseUrl: BASE, fetch }).signInWithEmail("a@b.test", "pw"),
    ).rejects.toMatchObject({ code, httpStatus: status });
  });
});

describe("boards repository adapter", () => {
  function setup() {
    const studio = createDemoStudioPort(createDemoSessionPort(0), { latencyMs: 0 });
    const { calls, fetch } = fakeServer(studio);
    const services = createApiServices({ baseUrl: BASE, fetch });
    return { studio, calls, services };
  }
  const scope = {} as never;

  it("lists boards with block counts and permissions", async () => {
    const { services } = setup();
    const boards = await services.boards.list(scope);
    expect(boards.length).toBeGreaterThan(0);
    for (const board of boards) {
      expect(board.blockCount).toBeGreaterThan(0);
      expect(typeof board.permissions.publish).toBe("boolean");
    }
  });

  it("follows cursors and caps pages", async () => {
    const { studio } = setup();
    const real = await studio.list({ kind: "board", search: null, cursor: null, limit: 200 });
    const item = real.items[0];
    if (!item) throw new Error("no boards");
    const pages: (string | null)[] = [];
    const paged = {
      ...studio,
      list: async (input: { cursor: string | null }) => {
        pages.push(input.cursor);
        return { items: [item], nextCursor: input.cursor === null ? "c1" : null };
      },
      get: studio.get,
    } as unknown as StudioApi;
    const { createBoardsRepositoryFromStudio } = await import("./boards-repository.js");
    const boards = await createBoardsRepositoryFromStudio(paged).list(scope);
    expect(pages).toEqual([null, "c1"]);
    expect(boards).toHaveLength(2);

    const endless = {
      ...paged,
      list: async (input: { cursor: string | null }) => {
        pages.push(input.cursor);
        return { items: [], nextCursor: "again" };
      },
    } as unknown as StudioApi;
    pages.length = 0;
    await createBoardsRepositoryFromStudio(endless).list(scope);
    expect(pages).toHaveLength(10);
  });

  it("reads published, draft, versions and throws not-found for a missing board", async () => {
    const { services, studio } = setup();
    const list = await studio.list({ kind: "board", search: null, cursor: null, limit: 200 });
    const id = list.items[0]?.id;
    if (!id) throw new Error("no boards");
    const published = await services.boards.getPublished(scope, id);
    expect(published.definition.blocks.length).toBeGreaterThan(0);
    const versions = await services.boards.listVersions(scope, id);
    expect(versions[0]?.version).toBeGreaterThan(0);
    const byVersion = await services.boards.getVersion(scope, id, versions[0]?.version ?? 1);
    expect(byVersion.definition).toBeTruthy();
    expect(await services.boards.getDraft(scope, id)).toSatisfy(
      (v: unknown) => v === null || typeof v === "object",
    );

    const missing = fakeNull();
    const error = await missing.getPublished(scope, id).catch((e: unknown) => e);
    expect(isApiClientError(error, "not-found")).toBe(true);
  });

  it("maps saveDraft, publish and rollback outcomes", async () => {
    const { services, studio } = setup();
    const list = await studio.list({ kind: "board", search: null, cursor: null, limit: 200 });
    const item = list.items.find((i) => i.permissions.edit && i.permissions.publish);
    if (!item) throw new Error("no editable board");
    const published = await services.boards.getPublished(scope, item.id);
    const draftVersion = (item.draftVersion ?? item.publishedVersion) as number;
    const saved = await services.boards.saveDraft({
      scope,
      boardId: item.id,
      baseVersion: draftVersion,
      bundle: published,
    });
    expect(saved.version).toBeGreaterThanOrEqual(draftVersion);
    const out = await services.boards.publish({
      scope,
      boardId: item.id,
      expectedVersion: saved.version,
      changeSummary: "adapter test",
      idempotencyKey: "adapter-test-key-1",
    });
    expect(out.auditEventId).toBeTruthy();
    const rolled = await services.boards.rollback({
      scope,
      boardId: item.id,
      expectedPublishedVersion: out.version,
      restoreVersion: item.publishedVersion as number,
      changeSummary: "adapter rollback",
      idempotencyKey: "adapter-test-key-2",
    });
    expect(rolled.version).toBeGreaterThan(out.version);
  });
});

function fakeNull() {
  const { fetch } = recorder(() => json({ result: { data: null } }));
  return createApiServices({ baseUrl: BASE, fetch }).boards;
}
