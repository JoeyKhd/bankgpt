# syntax=docker/dockerfile:1.7

# ============================================================
# Automation engine (apps/engine) — Hono API + WS + Playwright
# ============================================================

# ---- base: full browser runtime (Chromium needs these libs) ----
FROM node:22-trixie AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_PATH=/pnpm/store \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN corepack enable \
    && npx -y playwright@1.63.0 install-deps chromium
WORKDIR /repo

# ---- deps: full workspace node_modules from the lockfile ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/engine/package.json apps/engine/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter engine...

# ---- build: compile TypeScript to dist/ ----
FROM base AS build
COPY --from=deps /repo/ ./
COPY apps/engine ./apps/engine
RUN pnpm --filter engine build \
    && mkdir -p /repo/apps/engine/data \
    # Pre-install the matching Chromium build so the runtime stage does
    # not download it on first boot.
    && pnpm --filter engine exec playwright install chromium

# ---- prod deps: standalone prod node_modules (deploy, not symlink) ----
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/engine/package.json apps/engine/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter engine... \
    && pnpm deploy --filter engine --prod --legacy /out

# ---- runtime ----
FROM node:22-trixie AS runner
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HOSTNAME=0.0.0.0 \
    ENGINE_PORT=4011
WORKDIR /app
RUN addgroup --system nodejs && adduser --system --ingroup nodejs engine \
    # Chromium runtime libraries (already downloaded in base, apt is cached).
    && apt-get update \
    && npx -y playwright@1.63.0 install-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps --chown=engine:nodejs /out/node_modules ./node_modules
COPY --from=build --chown=engine:nodejs /repo/apps/engine/dist ./dist
# Canonical capability seeds, read on first boot (src/seed.ts, D-068).
COPY --from=build --chown=engine:nodejs /repo/apps/engine/seeds ./seeds
COPY --from=build --chown=engine:nodejs /repo/apps/engine/package.json ./package.json
COPY --from=build --chown=engine:nodejs /ms-playwright /ms-playwright
# SQLite lives on a named volume mounted at /data (ENGINE_DB_PATH).
RUN mkdir -p /data && chown engine:nodejs /data
USER engine
EXPOSE 4011
CMD ["node", "dist/index.js"]
