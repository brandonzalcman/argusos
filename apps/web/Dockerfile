# syntax=docker/dockerfile:1.7
# Static build of @argus/web served by an unprivileged nginx. Build context: the
# repository root, e.g.  docker build -f apps/web/Dockerfile -t argus-web .
#
# Scaffold only: this file has NOT been built or run. Public endpoints are
# build-time Vite variables; pass them with --build-arg or accept the defaults.
#
# Base image pinning: tags are defaults for local builds. Release builds MUST pass
# immutable digests (--build-arg NODE_IMAGE=...@sha256:<DIGEST>, NGINX_IMAGE=...).
# TODO(verify): resolve digests, pick a concrete nginx-unprivileged version tag
# (stable-alpine is a moving tag), and let Renovate bump tag and digest together.
ARG NODE_IMAGE=node:26.13.1-alpine3.23
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:stable-alpine

FROM ${NODE_IMAGE} AS build
ARG PNPM_VERSION=12.21.0
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @argus/web...
RUN pnpm --filter @argus/web... build

FROM ${NGINX_IMAGE} AS runtime
# Non-root (uid 101) base; the config below listens on 3000 and keeps every
# writable path under /tmp so the root filesystem can be read-only.
COPY --chown=101:101 deploy/docker/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=101:101 /workspace/apps/web/dist /usr/share/nginx/html
USER 101
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=6 \
  CMD wget --spider -q http://127.0.0.1:3000/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
