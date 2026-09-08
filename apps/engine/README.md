# engine

Automation engine for the computer-use system: goal-driven discovery,
deterministic replay of capability artifacts, and live-session human
handoff. Runs as its own TypeScript service, separate from the Next.js
frontend, so long-running browser sessions are not tied to web requests.

Status: scaffold only. The computer-use stack, LLM wiring, and the
frontend ↔ engine control channel are pending owner direction (see
`context/thought-process.md`).

## Scripts

- `pnpm --filter engine dev` — watch-run the service entrypoint (tsx)
- `pnpm --filter engine build` — compile to `dist/` (tsc)
- `pnpm --filter engine typecheck` / `lint` / `format`
