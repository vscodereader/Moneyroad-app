# syntax=docker/dockerfile:1
# Build context must be the repository root:
#   docker build -f apps/realtime/Dockerfile -t moneyroad-realtime .

FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---- builder: install workspace deps, build the app, isolate prod deps ----
FROM base AS builder
ENV CI=true
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm -F realtime build
RUN node apps/realtime/scripts/prune-prod-deps.mjs /prod
RUN --mount=type=cache,target=/root/.npm \
    cd /prod && npm install --omit=dev --no-audit --no-fund --loglevel=error

# ---- runtime: minimal image with only the built output + prod deps ----
FROM base AS runtime
ENV NODE_ENV=production
# Cloud Run injects PORT=8080; set it as the default so EXPOSE matches locally too.
ENV PORT=8080
WORKDIR /app

COPY --from=builder /prod/node_modules ./node_modules
COPY --from=builder /prod/package.json ./package.json
COPY --from=builder /app/apps/realtime/dist ./dist

EXPOSE 8080
USER node

CMD ["node", "dist/index.mjs"]
