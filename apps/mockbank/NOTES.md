# NOTES — decisions made while building apps/mockbank

For the parent worker's ledger entry. Each bullet is a choice I made and why.

- **TypeScript + Hono conversion (owner request).** The target now uses
  strict TypeScript ESM and Hono on `@hono/node-server`, matching the engine's
  server style. The legacy HTML, deterministic seed, latency, transient 500,
  session expiry, native confirm, and reset behavior are preserved. Scripts
  now include `dev`, `start`, `build`, `lint`, `format`, and `typecheck`.
- **No test files.** AGENTS.md bans scripted end-to-end verification unless
  the owner asks; sanity checks (`node --check`, boot + curl-style HTTP
  assertions per page/flow) were run from the agent kernel, not committed.
- **Port 4010, bind 127.0.0.1.** Localhost-only exposure for a target that
  accepts any credentials. `PORT` env override kept for parallel dev loops.
- **7 members seeded (task asked for ≥6).** IDs 100231, 100774, 101045,
  102388, 103520, 104816, 105293. Two members start with a Frozen card so the
  "Card is already frozen" outcome is reachable immediately after a reset.
- **Search:** exact member-ID match OR case-insensitive name substring;
  multiple name matches list one row each. Unknown IDs (e.g. starting with 0)
  render "No member found" as HTTP 200 — a business outcome per spec.
- **Issued identifiers are deterministic after reset:** new account numbers
  from 7100070001, confirmation numbers CNF-5001, CNF-5002, … so replay and
  evidence artifacts can assert exact values.
- **Validation failures re-render with HTTP 200** (not 4xx) — classic legacy
  app behavior and friendlier to replay than status-code branches.
- **Confirmation page requires `?c=CNF-####`** matching the issued number;
  otherwise it 404s. Keeps the "replay stops at the confirmation screen"
  checkpoint meaningful and reset-proof.
- **Transient 500 is counted per session on every GET carrying a live session
  cookie** (including `/session-expired`, `/login` when already signed in, and
  `/logout` — the classic legacy wart where even logout can fail transiently;
  retrying works). Unauthenticated GETs and all POSTs are never hit. The 500
  page carries no session chrome.
- **Latency is a single middleware-style delay** applied to every route except
  `/favicon.ico` (204, never delayed) and `POST /__reset__` (instant, so
  harness resets stay fast). `MOCKBANK_NO_DELAY=1` disables it for engine dev
  loops; evidence runs should leave it on.
- **Session expiry is inactivity-based** (`lastActivity` refreshed per
  request, TTL 5 min, `SESSION_TTL_MS` override for tests). Expiry deletes the
  session and redirects to `/session-expired`, which links back to `/login`.
- **The native confirm dialog is inline JS in the review page**
  (`window.confirm` in a submit handler) — the only JavaScript in the app, on
  purpose.
- **Session cookie** is `mockbank_session` (HttpOnly, SameSite=Lax), token is
  a random 192-bit hex. No credentials are checked or stored.
- **engine-worker briefly ran a stale build on port 4010** (started
  2026-09-09 ~01:39 UTC); coordinated over agent message — it killed the
  process and will wait for final run instructions. Its early smoke-run
  evidence predates the finished app.
