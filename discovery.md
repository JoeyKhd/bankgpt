# discovery.md — production discovery runbook

Everything you need to run so the chat suggestions (capabilities) exist and
work in production. Follow the phases in order; each phase lists exactly
what to check before moving on.

## Phase 0 — Prerequisites (one time per environment)

- [ ] Dokploy routes **two** public domains:
  - `bankgpt-app.lotshot.ai` → **frontend** container, port `3000`
  - `bankgpt-engine.lotshot.ai` → **engine** container, port `4011`,
    **WebSocket upgrades enabled** (the browser connects directly; the Next
    server cannot proxy WS)
- [ ] Root `.env` has all of:
  - `BETTER_AUTH_SECRET` (rotated — the one pasted into chat is exposed;
    `openssl rand -base64 32`)
  - `OPENROUTER_API_KEY` (rotated for the same reason)
  - `BETTER_AUTH_URL=https://bankgpt-app.lotshot.ai`
  - `NEXT_PUBLIC_SITE_URL=https://bankgpt-app.lotshot.ai`
  - `NEXT_PUBLIC_ENGINE_WS_URL=wss://bankgpt-engine.lotshot.ai/ws`
- [ ] Stack redeployed with the D-065 fix (`git pull` →
  `docker compose build && docker compose up -d`). After this deploy,
  env-only changes need just `docker compose up -d` (restart), no rebuild.
- [ ] Sign up in prod again — the production auth database starts empty
  (same reason the capabilities were gone). Your dev account does not
  exist there. The first account becomes the operator; grant the `admin`
  role from `/admin/users` if needed.

## Phase 1 — Smoke-check the wiring

- [ ] Admin console loads, no **"engine offline"** banner.
- [ ] `/admin/system` shows every env row **set**, including
  `NEXT_PUBLIC_ENGINE_WS_URL`.
- [ ] Browser devtools → Network → **WS** shows a connection to
  `wss://bankgpt-engine.lotshot.ai/ws` (if it tries
  `ws://127.0.0.1:4011/ws`, the frontend was not redeployed with D-065).

## Phase 2 — Discovery runs (this is what creates the capabilities)

In `/admin/discover`, run one discovery per flow. **The target URL must be
the compose service name** — inside the engine container, `localhost` is
the container itself:

| Goal (paste into the form) | Target URL |
| --- | --- |
| Log in to the teller console and read member 100231's savings and checking balances | `http://mockbank:4010` |
| Open a savings sub-account for member 100231 | `http://mockbank:4010` |

Mockbank's login is a demo console: **any credentials work**, so the goal
does not need to name a username/password — the model will make some up
and the distiller will record them as optional `tellerUsername` /
`tellerPassword` inputs.

Notes per run:

- Wait for the run to reach `done` (max ~3 min wall clock, 24 steps).
- The second flow is **risky** (money movement) — expect the policy to
  pause for an approval at the confirm step; approve it from a second
  operator account in `/admin/interventions`, or let it escalate and
  approve there.
- If a run reports `stuck`, open the run detail, read the reason, reword
  the goal, and re-run. Mockbank fights back on purpose: random latency,
  a transient 500 every 7th authenticated GET, 5-minute session expiry.
- Discovery needs `OPENROUTER_API_KEY` on the **engine** service — it is
  already in the compose env.

## Phase 3 — Review the capabilities

In `/admin/capabilities`:

- [ ] Open each new capability, check the typed inputs/outputs, the
  ordered steps, and the checkpoint.
- [ ] Fix first-draft semantics if needed (the distiller is a drafter,
  not a finisher).
- [ ] Complete the review pass → `reviewed: true` (bumps the version).
  **Risky capabilities refuse to replay until this is done.**

## Phase 4 — Verify in the caller chat

- [ ] In `/chat`, ask: *"What are member 100231's balances?"* → the
  `get_member_balances` capability replays deterministically (zero model
  calls).
- [ ] Ask to open a sub-account → the invoke tool returns
  `approval_pending`; a **different** operator approves in
  `/admin/interventions`; the chat card flips when the run settles
  (live via the WS channel — proof Phase 1 worked).

## Phase 5 — Keep the data alive

- Capabilities, runs, interventions, and evidence live on the named
  volume `engine-data` → `/data/engine.sqlite`. It survives
  `docker compose down`; `docker compose down -v` **wipes it** (that is
  why prod had no capabilities on first deploy — a fresh volume, not a
  bug).
- No automated backup is wired; to snapshot the capabilities:
  `docker compose exec engine cp /data/engine.sqlite /data/backup.sqlite`
  (or copy the volume out).

## If something fails

- **"engine offline" banner** → engine unhealthy or `ENGINE_URL` wrong
  (compose sets it to `http://engine:4011` internally; don't touch it).
- **Dead live controls / no inbox updates** → Phase 1, third bullet
  (WS routing or stale image).
- **Discovery can't reach the target** → you used `localhost:4010`;
  use `http://mockbank:4010`.
- **Capability exists in dev but not prod** → different SQLite databases;
  re-run discovery in prod. Data does not migrate between environments.
- Full detail in the docs site (`docs` service, internal port `3001`):
  [Troubleshooting](apps/docs/content/docs/troubleshooting.mdx).
