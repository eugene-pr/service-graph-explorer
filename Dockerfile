# syntax=docker/dockerfile:1

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/

# Production dependencies of the API only.
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@sge/api..."

# Build the domain package, the API and the web app.
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Slim runtime: same layout as the repo, so the bundled graph file resolves from apps/api/dist.
FROM node:22-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 WEB_DIST=/app/apps/web/dist
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /app/packages/domain/node_modules packages/domain/node_modules
COPY package.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY data data
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
