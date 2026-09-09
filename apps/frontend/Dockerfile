# syntax=docker/dockerfile:1.7

# ============================================================
# BankGPT frontend (apps/frontend) — Next.js 16 standalone
# ============================================================

# ---- deps: full workspace node_modules from the lockfile ----
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_PATH=/pnpm/store \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
# --filter frontend... = the app plus every dependency it needs.
# better-sqlite3 (and sharp/unrs-resolver) compile in this stage.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter frontend...

# ---- build: compile the app (standalone output) ----
FROM base AS build
COPY --from=deps /repo/ ./
COPY apps/frontend ./apps/frontend
# Next's page-data collection during `next build` executes route modules,
# and lib/db.ts opens the SQLite file at import time — the better-auth
# schema must already exist or collection fails with "no such table".
# Create a pre-migrated database for the build, and KEEP it as a seed: the
# runtime entrypoint copies it onto a fresh persistent volume on first boot
# so the container self-initializes without a network. Turbopack (the
# default) is required: withAui's generative bundler-redirect only works
# under Turbopack.
RUN mkdir -p apps/frontend/data /seed \
    && cd apps/frontend \
    && printf 'y\n' | BETTER_AUTH_SECRET=build-time-throwaway-secret-0123456789 \
        pnpm dlx @better-auth/cli@latest migrate --config lib/auth.ts \
    && cd ../.. \
    && cd apps/frontend \
    && node -e "const D=require('better-sqlite3');const db=new D('data/app.sqlite');db.pragma('wal_checkpoint(TRUNCATE)');db.close();" \
    && cd ../.. \
    && cp apps/frontend/data/app.sqlite /seed/app.sqlite \
    && pnpm --filter frontend exec next build \
    && rm -rf apps/frontend/data

# ---- prod node_modules for the standalone server ----
# The standalone bundle already embeds every traced module EXCEPT
# better-sqlite3 (Next lists it as external). It must resolve from
# node_modules at runtime, so deploy a real prod install of the frontend
# package and merge its node_modules over the traced ones.
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter frontend... \
    && pnpm deploy --filter frontend --prod --legacy /out

# ---- runtime ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/standalone ./
# Prod node_modules land under apps/frontend/node_modules (where the
# standalone server.js resolves them) — after the standalone copy so the
# real better-sqlite3 native binding wins over any traced copy.
# The full workspace node_modules go at the repo root so the entrypoint can
# resolve `@/` paths (better-auth, lib/auth.ts) for the boot-time migration.
COPY --from=prod-deps --chown=nextjs:nodejs /out/node_modules ./apps/frontend/node_modules
# Static assets and public/ are not part of the standalone trace.
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/public ./apps/frontend/public
# Pre-create the SQLite mount point with nextjs ownership so a fresh named
# volume inherits it (Docker copies the image's ownership into new volumes).
RUN mkdir -p /data && chown nextjs:nodejs /data
# Seed database: a build-time better-auth-migrated SQLite file. The
# entrypoint copies it onto the persistent volume on first boot so the
# container self-initializes offline (no runtime migrate / no network).
COPY --from=build --chown=nextjs:nodejs /seed/app.sqlite /seed/app.sqlite
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/docker-entrypoint.sh ./docker-entrypoint.sh
USER nextjs
EXPOSE 3000
# Compose overrides DATABASE_URL to /data/app.sqlite on the named volume.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "apps/frontend/server.js"]
