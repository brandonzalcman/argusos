import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { type FastifyTRPCPluginOptions, fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { sql } from "drizzle-orm";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { createBetterAuthAdapter } from "./auth/adapters.js";
import { type BetterAuthInstance, createBetterAuth } from "./auth/better-auth.js";
import type { BetterAuthPort, OidcProviderPort } from "./auth/ports.js";
import {
  type ApiConfig,
  parseApiEnvironment,
  resolveDatabaseUrl,
  resolveSecretRef,
} from "./config/env.js";
import { createDatabase, type DatabaseHandle } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { requestIdentifiers, tryResolveRequestContext } from "./http/request-context.js";
import type { TrpcContext } from "./trpc/init.js";
import { type AppRouter, createAppRouter } from "./trpc/router.js";

export interface ApiComposition {
  readonly config: ApiConfig;
  /** System connection (owner role): Better Auth, identity lookup and the request transactions. */
  readonly database: DatabaseHandle;
  /** Better Auth instance mounted at `/api/auth/*`. */
  readonly auth: BetterAuthInstance;
  readonly betterAuth: BetterAuthPort;
  readonly oidc: OidcProviderPort | null;
}

/** Fastify body limit: custom component source (<= 200k chars) plus JSON overhead fits easily. */
export const BODY_LIMIT_BYTES = 1_048_576;
const READINESS_TIMEOUT_MS = 2_000;

/**
 * Request log serializer: method and path only. The query string is never logged (tRPC queries carry
 * their JSON input in `?input=`, which may hold record data) and headers are omitted entirely.
 */
export function serializeRequestForLog(request: {
  readonly method?: string;
  readonly url?: string;
  readonly ip?: string;
  readonly id?: string;
}): { method?: string; url?: string; remoteAddress?: string } {
  const url = request.url === undefined ? undefined : (request.url.split(/[?#]/, 1)[0] ?? "");
  return {
    ...(request.method === undefined ? {} : { method: request.method }),
    ...(url === undefined ? {} : { url }),
    ...(request.ip === undefined ? {} : { remoteAddress: request.ip }),
  };
}

function toFetchHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (name === "x-forwarded-for" || name === "content-length") continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  // Rate limiting and session IP tracking must use the trust-proxy-aware address, never a client header.
  headers.set("x-forwarded-for", request.ip);
  return headers;
}

async function handleAuth(
  auth: BetterAuthInstance,
  config: ApiConfig,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const url = new URL(request.url, config.betterAuthUrl);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body =
    hasBody && request.body !== undefined && request.body !== null
      ? JSON.stringify(request.body)
      : undefined;
  const response = await auth.handler(
    new Request(url, {
      method: request.method,
      headers: toFetchHeaders(request),
      ...(body === undefined ? {} : { body }),
    }),
  );
  reply.status(response.status);
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") void reply.header(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) void reply.header("set-cookie", cookies);
  const text = await response.text();
  return reply.send(text.length > 0 ? text : null);
}

/**
 * Compose Fastify: helmet, CORS allowlist, Better Auth at `/api/auth/*`, tRPC at `/trpc`, health
 * probes. Authentication is resolved per request in the tRPC context from the verified Better Auth
 * session; tenant/position are never read from headers or bodies.
 * Errors: throws only for programmer/config errors; startup failures never include secrets.
 */
export async function createApiServer(dependencies: ApiComposition): Promise<FastifyInstance> {
  const { config, database, auth, betterAuth } = dependencies;
  const app = Fastify({
    bodyLimit: BODY_LIMIT_BYTES,
    // Trust only the configured number of proxy hops (0 = none: client addresses are never taken from headers).
    trustProxy: (_address: string, hop: number) => hop < config.trustedProxyHops,
    genReqId: () => randomUUID(),
    routerOptions: { maxParamLength: 5_000 },
    logger: {
      level: config.logLevel,
      serializers: { req: serializeRequestForLog },
      redact: {
        paths: ['req.headers["authorization"]', 'req.headers["cookie"]', "res.headers"],
        censor: "[redacted]",
      },
    },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: [...config.webOrigins],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  const allowedOrigins = new Set<string>([...config.webOrigins, config.betterAuthUrl]);

  // CSRF defence in depth for the app API: a browser-supplied Origin must be allowlisted.
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/trpc")) return;
    const origin = request.headers.origin;
    if (typeof origin === "string" && !allowedOrigins.has(origin)) {
      return reply.status(403).send({ error: "origin-not-allowed" });
    }
    return undefined;
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: (request, reply) => handleAuth(auth, config, request, reply),
  });

  await app.register(async (scope) => {
    await scope.register(fastifyTRPCPlugin, {
      prefix: "/trpc",
      trpcOptions: {
        router: createAppRouter({ database: database.db }),
        createContext: async ({ req }): Promise<TrpcContext> => {
          const { requestId, correlationId } = requestIdentifiers(req);
          const context = await tryResolveRequestContext(req, {
            betterAuth,
            database: database.db,
          });
          return { requestId, correlationId, context, deps: { database: database.db } };
        },
        onError: ({ error, req }) => {
          if (error.code === "INTERNAL_SERVER_ERROR") {
            // Code and request id only: never the cause chain (may embed SQL or parameters).
            app.log.error({ reqId: req.id, trpcCode: error.code }, "tRPC internal error");
          }
        },
      } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
    });
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await Promise.race([
        database.db.execute(sql`select 1`),
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("timeout")), READINESS_TIMEOUT_MS).unref(),
        ),
      ]);
      return { status: "ok" };
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  return app;
}

/** Build every port from configuration and an open database. Secrets are resolved here only. */
export function composeApi(
  config: ApiConfig,
  environment: Readonly<Record<string, string | undefined>>,
  database: DatabaseHandle,
): ApiComposition {
  const auth = createBetterAuth({
    database: database.db,
    secret: resolveSecretRef(config.betterAuthSecretRef, environment),
    baseURL: config.betterAuthUrl,
    trustedOrigins: [...config.webOrigins, config.betterAuthUrl],
  });
  return {
    config,
    database,
    auth,
    betterAuth: createBetterAuthAdapter({ auth, database: database.db }),
    oidc: null,
  };
}

/**
 * Validate the environment, open the database, (PGlite only) migrate, listen, and shut down
 * gracefully on SIGINT/SIGTERM. Resolves after shutdown completes.
 *
 * Migrations: `pglite:` databases are migrated automatically at start (local development).
 * `postgresql://` databases are NEVER migrated implicitly: run `pnpm --filter @argus/api db:migrate`
 * with a migration-capable role first.
 * Security: the database URL and secrets are never logged.
 */
export async function startApi(
  environment: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const config = parseApiEnvironment(environment);
  const database = await createDatabase(resolveDatabaseUrl(config, environment));
  let app: FastifyInstance | null = null;
  try {
    if (database.driver === "pglite") await runMigrations(database);
    app = await createApiServer(composeApi(config, environment, database));
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    await app?.close().catch(() => undefined);
    await database.close().catch(() => undefined);
    throw error;
  }

  const server = app;
  await new Promise<void>((resolve) => {
    let stopping = false;
    const stop = (signal: string) => {
      if (stopping) return;
      stopping = true;
      server.log.info({ signal }, "shutting down");
      void server
        .close()
        .catch(() => undefined)
        .then(() => database.close())
        .catch(() => undefined)
        .then(() => resolve());
    };
    process.once("SIGINT", () => stop("SIGINT"));
    process.once("SIGTERM", () => stop("SIGTERM"));
  });
}
