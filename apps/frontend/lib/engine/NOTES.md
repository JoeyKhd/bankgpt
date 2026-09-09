# lib/engine — frontend ↔ engine data layer

Decisions behind this module, for the ledger (D-041 implementation).

## What lives here

- `schemas.ts` — zod mirrors of the engine contract: the capability
  artifact (`apps/engine/src/artifact.ts`), the run-result taxonomy
  (`src/results.ts`), step evidence (`src/evidence.ts`), and the HTTP wire
  rows (`src/db.ts` + `src/server.ts`). Types are derived with `z.infer`;
  there are no hand-written parallel interfaces. The engine's schemas stay
  canonical — this mirror must be updated in the same change as any engine
  contract change.
- `client.ts` — **server-only** typed client. Reads `ENGINE_URL`
  (default `http://127.0.0.1:4011`, the engine's dev port), 8s timeout,
  validates every response with zod before it crosses into the app.
- `proxy.ts` — **server-only** wrapper for the `/api/engine/*` route
  handlers: session check (same pattern as `app/api/chat/route.ts`) +
  error mapping.
- `queries.ts` — **browser-safe** `@tanstack/react-query` layer: domain
  query keys (`engineKeys.*`), `queryOptions` factories, and mutation
  functions. Fetchers call the `/api/engine` proxy, never the engine
  directly. They validate responses with the same zod schemas.
- `index.ts` — browser-safe barrel (schemas + errors + queries). Import
  `client`/`proxy` by their own paths from server code only.
- `errors.ts` — shared taxonomy: `EngineOfflineError` (unreachable),
  `EngineHttpError` (non-2xx, status + engine message),
  `EngineValidationError` (contract drift). Both sides throw the same
  classes; UI branches on `isEngineOffline(err)` / `isEngineError(err)`.

## Normalization choices

- Capability **list** rows arrive with `artifact` as an unparsed JSON
  string and `reviewed` as SQLite 0/1; the client drops the artifact string
  and returns `EngineCapabilitySummary` (reviewed: boolean). The **detail**
  endpoint parses + validates the full artifact.
- Run rows store `result` as a JSON string; the client parses and validates
  it (`RunResult` for replay runs, `DiscoveryResult` for discovery runs —
  `EngineRunResult` union). `null` while running.
- Intervention rows store `context` as a JSON string; parsed to a record.
- Capabilities list is one row **per stored version**, newest first —
  dedupe by id for counts (see `app/(app)/admin/page.tsx`).

## Degradation model

The owner runs the engine separately. When it is unreachable:

- proxy routes answer **503** `{ error, hint }`;
- `queries.ts` fetchers turn 503 (or a network failure) into
  `EngineOfflineError`, so `useQuery` consumers can render an explicit
  "engine offline" state instead of a generic error;
- the `/admin` overview (server component) catches engine errors and falls
  back to the stub catalog with an offline banner.

## Deliberately out of scope (later phases)

- **WebSocket channel** (`/ws` on the engine: run-step stream +
  pause/cede/resume). Next route handlers cannot proxy WS upgrades; the
  live-session UI will need its own answer (e.g. a direct client-side
  socket gated by a server-issued config, or a small WS proxy service).
- QueryClientProvider mounting — Phase 3 owns the admin pages that consume
  these queries.
- `POST /capabilities` (save/upsert artifact) — the engine's own discovery
  flow writes artifacts; no console use case yet.

## Env

`ENGINE_URL` (OPTIONAL) added to `apps/frontend/.env.example`; set
explicitly in `.env.local` for dev. Server-side only — never
`NEXT_PUBLIC_`, the browser only ever sees `/api/engine/*`.
