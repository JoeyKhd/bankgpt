# syntax=docker/dockerfile:1.7

# ============================================================
# Docs site (apps/docs) — Fumadocs on Next.js 16, standalone
# ============================================================

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_PATH=/pnpm/store \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/docs/package.json apps/docs/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter docs...

# ---- build: compile the site (standalone output) ----
FROM base AS build
COPY --from=deps /repo/ ./
COPY apps/docs ./apps/docs
RUN pnpm --filter docs exec next build --webpack

# ---- runtime ----
# No native deps in the docs app: the standalone bundle is self-contained.
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001
WORKDIR /app
RUN addgroup -S nodejs && adduser -S docs -G nodejs
COPY --from=build --chown=docs:nodejs /repo/apps/docs/.next/standalone ./
COPY --from=build --chown=docs:nodejs /repo/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=build --chown=docs:nodejs /repo/apps/docs/public ./apps/docs/public
USER docs
EXPOSE 3001
CMD ["node", "apps/docs/server.js"]
