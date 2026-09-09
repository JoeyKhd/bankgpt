# BankGPT — computer-use automation for back-office banking apps

**interface.ai engineering take-home** — the backend integration layer that
gives an AI agent hands inside applications with no API.

An LLM **discovers** a back-office UI flow once — driving a real browser,
observing the accessibility tree, one structured model call per step — and
the successful run is distilled into a typed, versioned **capability
artifact**. From then on the flow **replays deterministically with zero
model calls**: a calling AI agent invokes the capability with typed inputs
and gets back typed outputs, a known business outcome, or a debuggable
failure. Human operators approve risky actions (with maker ≠ checker
segregation) and can take over the **same live session** when automation
gets stuck, then hand control back.

- Design write-up: **[REPORT.md](REPORT.md)**
- Graded run evidence (genuine discovery + replay runs): lives in the
  engine's SQLite DB (D-059) — see
  [REPORT.md#architecture](REPORT.md#architecture) and the query notes
  below
- Decision ledger (D-001…D-050): [context/thought-process.md](context/thought-process.md)
- Assignment: [context/assignment.md](context/assignment.md)

## Monorepo layout

| Path | What it is |
| --- | --- |
| `apps/engine` | The automation service: LLM discovery loop, artifact schema, deterministic replay, policy/redaction, approvals, live-session handoff. TypeScript ESM, Hono HTTP API + WebSocket control channel (default port `4011`), SQLite via better-sqlite3. |
| `apps/frontend` | Operator console + caller simulation. Next.js 16.2.6 (App Router) + React 19 + Tailwind 4 + shadcn, better-auth, assistant-ui + AI SDK v7. `/admin` is the operator console (capabilities, runs, discovery, interventions inbox with take-over panel); `/chat` simulates the calling AI agent invoking capabilities. Default port `3000`. |
| `apps/mockbank` | **FinCore Teller** — the proxy target. A zero-dependency (`node:http`), deliberately hostile mock back-office banking console: legacy table markup, no test IDs, artificial latency, a transient HTTP 500 every 7th GET, session expiry, and a native `window.confirm` gate. Default port `4010`. |
| `apps/docs` | This documentation site. Fumadocs (Next.js 16 + Fumadocs MDX) in the BankGPT dark-only brand; content lives in `apps/docs/content/docs/`. Default port `3001`. |
| `context/` | Assignment, product brief, decision ledger, research. |
| `docker-compose.yaml` + per-app `Dockerfile` | One-command container stack: frontend, engine (with Chromium), mockbank, docs; SQLite databases persist on named volumes. |

Run evidence is not a checked-in folder: every run's step log, transcript,
result, and failure/handoff screenshots are stored as blobs in the engine's
SQLite DB (`run_files` table, D-059) and served over the engine HTTP API at
`/runs/:id/files` and `/runs/:id/files/:name`.

## Setup

Requirements: **Node 22+** and **pnpm 10** (`packageManager` is pinned).

```bash
pnpm install                                          # from the repo root
pnpm --filter engine exec playwright install chromium # one-time browser download
```

Environment:

- **`OPENROUTER_API_KEY`** — the one external-service key. Needed for
  discovery (the engine's model calls) and for the `/chat` caller
  simulation. Put it in **`apps/engine/.env.local`** (copy
  `apps/engine/.env.example`) and/or **`apps/frontend/.env.local`** (copy
  `apps/frontend/.env.example`). Replay never needs it.
- **`BETTER_AUTH_SECRET`** — required by the frontend for auth
  (`apps/frontend/.env.local`); generate locally with
  `openssl rand -base64 32`. It is a local signing secret, not a service key.
- Optional, all with working defaults: `ENGINE_PORT` (4011),
  `ENGINE_DB_PATH` (engine); `ENGINE_URL`
  (`http://127.0.0.1:4011`) and `NEXT_PUBLIC_ENGINE_WS_URL`
  (`ws://127.0.0.1:4011/ws`) (frontend → engine wiring; the browser connects
  to the WS directly because Next route handlers cannot proxy upgrades).

Never commit real keys: both `.env.local` files are gitignored, and the
engine redacts secret/PII-shaped values from everything it persists.

## Run

**One command starts the whole demo** (mockbank :4010 + engine :4011 +
frontend :3000 + docs :3001, in parallel) — do not also start the services
individually:

```bash
pnpm dev                      # everything → http://localhost:3000 (docs: :3001)
```

Or run the same stack in Docker (`docker compose up` — see the Docker
section below for persistent SQLite volumes and the `targetUrl` caveat).

### Docker (alternative)

The same stack runs in containers — one image per app
(`apps/frontend/Dockerfile`, `apps/engine/Dockerfile`,
`apps/mockbank/Dockerfile`, `apps/docs/Dockerfile`) plus a root
`docker-compose.yaml`:

```bash
cp .env.example .env   # set BETTER_AUTH_SECRET + OPENROUTER_API_KEY
docker compose build
docker compose up      # frontend :3000, docs :3001, engine :4011, mockbank :4010
```

Both SQLite databases persist on named volumes (`frontend-data` →
`/data/app.sqlite`, `engine-data` → `/data/engine.sqlite`); they survive
`docker compose down` and are only wiped by `docker compose down -v`. The
engine image ships Chromium, so discovery and replay work in containers —
but the Playwright browser runs **inside the engine's network**, so a
discovery `targetUrl` must use the service name (`http://mockbank:4010`),
not `localhost`. The frontend container seeds the better-auth
schema onto a fresh volume on first boot (a build-time migrated database
is baked into the image and copied over only when the volume is empty).

Open `http://localhost:3000` and register — **the first registered user is
the admin**. `/chat` is the caller simulation (ask it to look up a member or
open a sub-account; risky capabilities raise a segregated operator
approval). `/admin` holds the capability catalog, run history, discovery
form, and the interventions inbox with the live-session take-over panel.

If you ever need one service on its own (debugging, the CLI demo below),
use the per-app scripts (`pnpm --filter mockbank dev`,
`pnpm --filter engine dev`, `pnpm --filter frontend dev`) — but then do not
also run `pnpm dev`, or the ports collide.

First run only: the frontend's auth schema must exist before sign-in works.
If `apps/frontend/data/app.sqlite` does not exist yet, create it once:

```bash
cd apps/frontend && pnpm dlx @better-auth/cli@latest migrate --config lib/auth.ts
```

## Demo path (discover → replay)

The graded demo is CLI-driven and needs only the mockbank + the engine CLI
(the dev server and console are not required for it). `POST /__reset__`
reseeds the target so account/confirmation counters and the transient-500
cadence are deterministic — run it before each run:

```bash
curl -X POST http://127.0.0.1:4010/__reset__

# 1. Genuine LLM-driven discovery (requires OPENROUTER_API_KEY).
#    The model drives a live Chromium via the accessibility tree, then the
#    run is distilled into a typed capability artifact.
pnpm --filter engine discover \
  --goal "Log in to the teller console and read member 100231's savings and checking balances" \
  --target http://127.0.0.1:4010

pnpm --filter engine discover \
  --goal "Open a new savings sub-account for member 100231 with an initial deposit of 250 and reach the confirmation screen" \
  --target http://127.0.0.1:4010

#    Each discover prints the RETURNED artifact id (savedArtifactId) — use
#    exactly that id below. Freshly distilled artifacts are reviewed:false.

# 2. Review the artifact (required before a RISKY capability replays).
#    Human review is part of the workflow: read the stored artifact
#    (query the capabilities table, or GET /capabilities/<id> with the
#    server running), fix target bindings or detect strings if needed,
#    then re-import + mark it reviewed. Safe capabilities replay
#    unreviewed; risky ones do not.
#      - Read the stored artifact with:
#          sqlite3 apps/engine/data/engine.sqlite \
#            "SELECT artifact FROM capabilities WHERE id='<id>'"
#        With the server running: POST /capabilities (import the edited
#        artifact) then POST /capabilities/<id>/review.
#      - For the CLI demo the stored graded artifacts already carry
#        reviewed:true from their documented review pass (below).

# 3. Deterministic replay (ZERO model calls; no API key needed).
pnpm --filter engine replay --capability get_member_balances --input memberId=100231

# Exceptional replays — expected business outcomes, not crashes:
curl -X POST http://127.0.0.1:4010/__reset__
pnpm --filter engine replay --capability get_member_balances --input memberId=999999
#   → business_outcome: member_not_found

pnpm --filter engine replay --capability open_sub_account \
  --input memberId=100231 --input accountType=savings --input initialDeposit=250
#   → success {accountNumber: "7100070001", confirmationNumber: "CNF-5001"}

pnpm --filter engine replay --capability open_sub_account \
  --input memberId=100231 --input accountType=savings --input initialDeposit=-50
#   → business_outcome: invalid_input ("Initial deposit cannot be negative.")
```

Notes on the replay path:

- CLI replay reads the artifact from the engine DB (the `capabilities`
  table in `apps/engine/data/engine.sqlite`, written there by `discover`).
  The **reviewed, graded artifacts** are already stored there (imported
  from the retired on-disk bundle, D-059) — nothing to copy. To inspect
  one by hand:
  `sqlite3 apps/engine/data/engine.sqlite "SELECT json_extract(artifact, '$.version'), reviewed FROM capabilities WHERE id='open_sub_account'"`
  or, with the engine server running, `GET /capabilities/<id>`.
- The risky `open_sub_account` artifact replays via CLI because CLI runs are
  operator-invoked (approval is implicit), but policy still refuses an
  **unreviewed** risky artifact — the graded artifact carries
  `reviewed: true` from its documented human review pass.

## Running without live services

- The mockbank target is fully local — no external calls, no credentials
  (any sign-in works), only fictional seed data.
- **Replay is model-free**: once an artifact exists, replay needs no
  `OPENROUTER_API_KEY` and no network beyond localhost. Only **discovery**
  (and the `/chat` simulation) calls a model.
- The console degrades gracefully when the engine is offline: the
  `/api/engine/*` proxy answers 503 with a hint, client fetchers raise a
  typed `EngineOfflineError`, and the `/admin` overview falls back to the
  stub catalog with an amber offline banner.

## Where to look next

- **[REPORT.md](REPORT.md)** — architecture, artifact schema, determinism &
  error handling, heterogeneity/multi-tenant design, escalation & handoff,
  safety, cuts.
- **The graded run evidence (D-059)** — stored in the engine DB, not a
  checked-in folder: two genuine discovery runs, happy-path + exceptional
  replays, a transient-500 recovery probe, a deterministic-repeat run, and
  the two segregation-of-duties proof runs (segregated approval; stuck →
  live-session take-over → resume). Browse runs in the `/admin` console or
  query directly, e.g.
  `sqlite3 apps/engine/data/engine.sqlite "SELECT id, kind, status FROM runs"`
  and `sqlite3 apps/engine/data/engine.sqlite "SELECT name, contentType, length(data) FROM run_files WHERE runId='<runId>'"`;
  with the engine server running, `GET /runs`, `GET /runs/:id/evidence`,
  and `GET /runs/:id/files[/:name]` serve the same rows over HTTP.
- `apps/engine/README.md` — engine architecture page, full HTTP/WS API.
- `apps/mockbank/README.md` — the target's seed data and deliberate hostility.
