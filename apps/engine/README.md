# engine

Automation engine for the computer-use system: **genuine LLM-driven
discovery** that distills a successful run into a typed **capability
artifact**, plus **deterministic replay** of that artifact with no model in
the loop. Runs as its own TypeScript service, separate from the Next.js
frontend, so long-running browser sessions are not tied to web requests
(D-023, D-039, D-041).

## Architecture in one page

```
goal ─▶ discovery (observe → decide → act, LLM each step) ─▶ capability artifact
                                                                   │
                    replay (zero model calls) ◀────────────────────┘
                          │
        success(outputs) | business_outcome | recoverable | hard_failure
```

- **`src/artifact.ts`** — the capability artifact contract (zod). Ordered
  steps; every step target records its primary a11y locator (role +
  accessible name) plus css/text fallbacks and a robustness note; typed
  inputs/outputs; a machine-checkable checkpoint; a `businessOutcomes`
  detect table. This schema is the single source of truth.
- **`src/discovery.ts`** — the observe → decide → act loop. Observe =
  `page.ariaSnapshot()` (YAML a11y tree) + screenshot; decide = one
  structured model call (AI SDK `generateText` + `Output.object`, zod
  action schema); act = Playwright `getByRole`. Stops on goal-met, stuck,
  max steps, or timeout. On success, one more model call distills the
  transcript into an artifact.
- **`src/replay.ts`** — the deterministic executor. Resolves targets by
  primary locator then fallbacks, substitutes typed inputs, extracts
  declared outputs, checks business outcomes after each step and the
  checkpoint at the end. Never continues blindly after an error; transient
  failures get a bounded retry. Result taxonomy in `src/results.ts`.
- **`src/policy.ts`** — configurable allowlist (URL patterns + action
  types), safe/risky classification with an approval-token enforcement
  seam, and redaction of secret/PII-shaped values from everything
  persisted.
- **`src/evidence.ts`** — per-step JSONL logs (action, target, reason,
  duration, result), screenshot + aria snapshot on failure, and the full
  discovery transcript. Everything redacted before writing.
- **`src/db.ts`** — SQLite (better-sqlite3, WAL): capabilities, runs,
  interventions/approvals.
- **`src/server.ts`** — Hono HTTP API (@hono/node-server) + WebSocket
  control channel (pause / cede / resume for the live-session handoff),
  bodies validated with @hono/zod-validator. `src/session.ts` holds the
  session registry + control state machine.
- **`src/cli.ts`** — the demo entrypoint (below).

## Setup

```bash
pnpm install                                   # from repo root
pnpm --filter engine exec playwright install chromium
cp apps/engine/.env.example apps/engine/.env.local  # fill OPENROUTER_API_KEY
```

### TypeScript toolchain

The engine and mockbank **compile and typecheck with the native TypeScript 7
compiler** (`typescript@7`, the Go-based `tsc`). Because typescript-eslint
(and the classic `tsc` API) requires the TypeScript 5 compiler, the packages
keep `typescript@5` for ESLint and expose TS 7 through the `ts7`
(`npm:typescript@7`) alias. The `build` / `typecheck` scripts invoke
`node ./node_modules/ts7/bin/tsc` explicitly so the `tsc` bin-name collision
between the two packages cannot pick the wrong compiler.

## CLI (demo commands)

```bash
# 1. Run the proxy target (apps/mockbank) on port 4010, then:
pnpm --filter engine discover --goal "Log in ... and read balances" \
  --target http://127.0.0.1:4010

# 2. Replay the saved capability deterministically:
pnpm --filter engine replay --capability <id> --input memberId=100231
```

Both print structured JSON results. Artifacts land in
`apps/engine/evidence/artifacts/`, per-run evidence (steps, transcript,
failure screenshots) in `apps/engine/evidence/runs/<runId>/`.

## HTTP API (`pnpm --filter engine dev`, default port 4011)

The HTTP surface is a **Hono** app served by `@hono/node-server`; request
bodies are validated with `@hono/zod-validator` (zod schemas in
`src/server.ts`); every JSON response is policy-redacted. The WebSocket
control channel shares the same listener via `upgradeWebSocket`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | liveness |
| GET | `/capabilities` | list saved capability rows |
| GET | `/capabilities/:id` | one capability row (`artifact` as a JSON string, like the DB row) |
| POST | `/capabilities` | save/upsert an artifact (zod-validated) |
| POST | `/capabilities/:id/review` | mark reviewed |
| POST | `/discover` | start a discovery run (async, `{goal, targetUrl, model?}`, 202 + WS) |
| POST | `/replay` | start a replay run (async, `{capabilityId, inputs, approvalToken?}`, 202 + WS) |
| GET | `/runs` / `/runs/:id` | run rows (`result` as a JSON string, like the DB row) |
| GET | `/runs/:id/evidence` | step log for a run |
| GET | `/approvals` | list interventions/approvals |
| POST | `/approvals` | request-first approval for a risky capability (creates the run, status `awaiting_approval`, 201 + `{id, runId}`) |
| GET | `/approvals/:id` | one intervention |
| POST | `/approvals/:id/approve` / `reject` | answer an approval (approve issues a one-time scoped token and starts the run; identity-carrying `decidedBy` required) |
| GET | `/sessions/:runId/state` | live session state (ownership, url, aria, screenshot, control log) |
| POST | `/sessions/:runId/action` | one manual operator action on the live session (human-owned only; also at the unsuffixed `/sessions/:runId`) |

WebSocket at `/ws` (browser connects directly via
`NEXT_PUBLIC_ENGINE_WS_URL`): streams `run-step` / `run-finished` /
`capability-saved` / `intervention-requested` / `session-opened` /
`session-closed` / `control-state` / `human-action` events, and accepts
`{type: "pause"|"cede"|"resume"|"human-action", runId, operator?, detail?}`
control messages for the live-session handoff.

## Environment

See `.env.example` (names only): `OPENROUTER_API_KEY` (required for
discovery), `ENGINE_PORT`, `ENGINE_DB_PATH`, `ENGINE_EVIDENCE_DIR`.
