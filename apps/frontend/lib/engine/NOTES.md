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


## Phase 3 — console pages built on this layer (appended)

The four `/admin` surfaces now consume these queries live (PageStub replaced
everywhere except `/admin/interventions`, which a sibling worker owns):

- `components/admin/engine-providers.tsx` mounts the `QueryClientProvider`
  in `app/(app)/admin/layout.tsx` — required before any hook here works.
- `components/admin/engine-ui.tsx` holds the shared query states (offline
  banner matching the `/admin` overview pattern, error banner, skeletons,
  empty states) plus status/risk/kind pills and date/duration formatters.
- `/admin/capabilities` — `capabilitiesQuery` deduped by id (latest version
  first, same rule as the overview); target app and step count are enriched
  per card from `capabilityQuery(id)` because list rows carry no artifact.
- `/admin/capabilities/[id]` — full artifact rendering (steps with
  primary/fallback locators + robustness, typed inputs/outputs, final
  checkpoint, business outcomes), `markCapabilityReviewed`, and a replay
  form (`@tanstack/react-form`, per-input zod validators derived from the
  artifact's typed inputs) that calls `startReplay` and links to the run.
- `/admin/runs` + `/admin/runs/[id]` — run history and detail. The result
  union narrows at render time: replay success shows `outputs`, discovery
  success shows `goal`/`capabilityId`; `hard_failure` renders expected vs
  observed side by side.
- `/admin/discover` — `startDiscovery` form (goal + http(s) targetUrl +
  optional model), then embeds `RunDetail` for the new run.

Live-streaming note: `runEvidenceQuery` deliberately does not poll (it is
append-only). `RunDetail` refetches evidence whenever the polling
`runQuery` row updates while `status === "running"`, so steps stream in
every ~2s without changing `lib/engine`.

Contract notes: run evidence lives in the engine's SQLite DB (D-059) —
screenshots/snapshots are served from `run_files` via
`GET /runs/:id/files` and `GET /runs/:id/files/:name`; hard failures no
longer surface an `evidenceDir` path. The capability list endpoint exposes
no `targetApp`/step count, hence the per-card detail fetch.


## Policy surface (appended)

The `/admin/policy` page is now a live, read-only view of the engine's
effective safety policy instead of a hardcoded stub:

- Engine: `GET /policy` in `apps/engine/src/server.ts` answers the
  effective `Policy` (redacted through `redactValue` like every JSON
  response). There is deliberately **no** write route — the policy is
  defined in code (`defaultPolicy()` in `apps/engine/src/policy.ts`, or
  `ServerOptions.policy` injected by the host) and editing stays a config
  concern; the assignment asks for a configurable allowlist, not a policy
  editor.
- `schemas.ts` — `enginePolicySchema` mirrors `PolicySchema` (the engine
  answers the fully-parsed policy, so all defaulted fields are present on
  the wire). Redaction is intentionally NOT in the schema: it is
  engine-side code (`redactText` / `redactValue`), not a tunable field.
- `client.ts` — `getEnginePolicy()`; proxy route
  `app/api/engine/policy/route.ts` (`engineRoute`, auth-gated, 503 when
  offline).
- `queries.ts` — `engineKeys.policy()`, `fetchEnginePolicy`,
  `policyQuery()` (no polling: the policy is static per engine process).
- `components/admin/policy-view.tsx` — renders the URL allowlist, allowed
  vs safe action chips, the derived risky-action set (`allowedActions`
  minus `safeActions` → approval per occurrence), risky classes requiring
  approval, `requireReviewForRisky`, dialog handling, transient-reload /
  discovery / handoff bounds, and a redaction summary (engine-enforced).
  Loading skeleton, amber engine-offline banner (with a note pointing at
  `defaultPolicy()` — never hardcoded fallback values), and error banner
  match the other admin pages.
