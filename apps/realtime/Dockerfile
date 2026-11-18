# syntax=docker/dockerfile:1.7
# Multi-stage image for @argus/realtime. Build context: repository root, e.g.
#   docker build -f apps/realtime/Dockerfile -t argus-realtime .
#
# Scaffold only: application startup, /health/live, /health/ready and graceful
# shutdown remain implementation work. This file has NOT been built or run.
#
# Base image pinning. NODE_IMAGE is a tag by default so local builds work.
# Release builds MUST pass an immutable digest:
#   --build-arg NODE_IMAGE=node:26.13.1-alpine3.23@sha256:<DIGEST>
# TODO(verify): resolve the digest of the chosen tag (`docker buildx imagetools
# inspect node:26.13.1-alpine3.23`), record it in the release pipeline, and let
# Renovate bump tag and digest together.
ARG NODE_IMAGE=node:26.13.1-alpine3.23

FROM ${NODE_IMAGE} AS build
ARG PNPM_VERSION=12.21.0
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store     pnpm install --frozen-lockfile --filter @argus/realtime...
RUN pnpm --filter @argus/realtime... build
# Produce a self-contained production tree: only runtime dependencies and the
# built workspace packages, no sources, dev dependencies or other apps.
# TODO(verify): pnpm >=10 requires `--legacy` unless inject-workspace-packages is
# enabled; confirm the flag for pnpm 12 and that dist/ of workspace packages is
# included (npm-packlist honours .gitignore, which lists dist/).
RUN pnpm --filter @argus/realtime deploy --prod --legacy /out

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV REALTIME_PORT=3002
COPY --from=build --chown=node:node /out /app
# The official node image ships an unprivileged "node" user (uid 1000). Kubernetes
# overrides the uid via runAsUser; files stay world-readable, none are writable.
USER node
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=6   CMD node -e "fetch('http://127.0.0.1:3002/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
