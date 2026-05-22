# syntax=docker/dockerfile:1
# Build context must be the repository root:
#   docker build -f apps/server/Dockerfile -t moneyroad-server .

FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---- builder: install workspace deps, build the server, isolate prod deps ----
FROM base AS builder
# Non-interactive build: let pnpm reconcile node_modules without a TTY prompt.
ENV CI=true
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm -F server build
# tsdown bundles the workspace packages and their transitive deps, leaving only
# the server's direct npm deps external. Emit a pinned package.json for just
# those and install them into a minimal, flat node_modules for the runtime.
RUN node apps/server/scripts/prune-prod-deps.mjs /prod
RUN --mount=type=cache,target=/root/.npm \
    cd /prod && npm install --omit=dev --no-audit --no-fund --loglevel=error

# ---- runtime: minimal image with only the built output + prod deps ----
FROM base AS runtime
ENV NODE_ENV=production
ENV MIGRATIONS_FOLDER=./migrations
WORKDIR /app

COPY --from=builder /prod/node_modules ./node_modules
COPY --from=builder /prod/package.json ./package.json
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/packages/db/src/migrations ./migrations

EXPOSE 3000
USER node

# The container runs only the server. Migrations are applied as a separate step
# (CI/CD or a release hook) so they run exactly once and the app stays stateless:
#   docker run --rm --env-file apps/server/.env <image> node dist/migrate.mjs
CMD ["node", "dist/index.mjs"]
