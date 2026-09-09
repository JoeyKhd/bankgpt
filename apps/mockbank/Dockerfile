# syntax=docker/dockerfile:1.7

# ============================================================
# FinCore Teller mock target (apps/mockbank) — Hono server
# ============================================================

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_PATH=/pnpm/store
RUN corepack enable
WORKDIR /repo

# ---- deps: full workspace node_modules from the lockfile ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/mockbank/package.json apps/mockbank/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter mockbank...

# ---- build: compile TypeScript to dist/ ----
FROM base AS build
COPY --from=deps /repo/ ./
COPY apps/mockbank ./apps/mockbank
RUN pnpm --filter mockbank build

# ---- prod deps ----
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/mockbank/package.json apps/mockbank/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter mockbank... \
    && pnpm deploy --filter mockbank --prod --legacy /out

# ---- runtime ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    MOCKBANK_HOST=0.0.0.0 \
    PORT=4010
WORKDIR /app
RUN addgroup -S nodejs && adduser -S mockbank -G nodejs
COPY --from=prod-deps --chown=mockbank:nodejs /out/node_modules ./node_modules
COPY --from=build --chown=mockbank:nodejs /repo/apps/mockbank/dist ./dist
COPY --from=build --chown=mockbank:nodejs /repo/apps/mockbank/package.json ./package.json
USER mockbank
EXPOSE 4010
CMD ["node", "dist/server.js"]
