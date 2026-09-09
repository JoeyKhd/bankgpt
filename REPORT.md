# Design report — computer-use automation system

The system: an LLM discovers a back-office UI flow once, the run is distilled
into a typed capability artifact, and a calling AI agent then invokes that
capability through deterministic, model-free replay. Operators approve risky
actions and take over live sessions when automation is stuck. The graded
evidence for every claim below is in [`/evidence/`](evidence/README.md);
the full decision history is the ledger (`context/thought-process.md`,
D-001…D-049).

# Architecture

Three processes with explicit boundaries (D-023, D-041, D-048):

- **`apps/engine`** — the automation service and the graded core. It owns the
  discovery loop, the artifact schema, deterministic replay, policy and
  redaction, the approvals store, and the live-session control model. It
  exposes a Hono HTTP API plus a WebSocket control channel on one listener
  (`@hono/node-server` + `upgradeWebSocket`), validates every body with
  `@hono/zod-validator`, redacts every JSON response, and persists
  capabilities/runs/interventions in SQLite (better-sqlite3, WAL).
- **`apps/frontend`** — the operator surface. A Next.js 16 (React 19) app
  with the `/admin` console (capabilities, runs, discovery, interventions
  inbox with a live take-over panel) and a `/chat` caller simulation
  (assistant-ui + AI SDK v7) that invokes capabilities by name with typed
  inputs. The frontend never calls the engine from the browser over HTTP: a
  server-only typed client validates every engine response with zod mirrors
  of the engine contract, behind auth-gated `/api/engine/*` proxies that
  degrade to an explicit offline state (D-044). The browser connects to the
  engine's `/ws` directly because Next route handlers cannot proxy WebSocket
  upgrades (D-047).
- **`apps/mockbank`** — FinCore Teller, a zero-dependency `node:http` mock
  back-office console and the proxy target. It is deliberately hostile:
  legacy table markup with no ids or test IDs, random latency, a transient
  HTTP 500 every 7th authenticated GET, 5-minute session expiry, and a
  native `window.confirm` gating the risky submit (D-040).

Key decisions and trade-offs:

- **Separate engine process** (D-023). Long-running browser automation and
  human handoff cannot be tied to web request lifecycles; a service keeps
  the pause/cede/resume control channel explicit. Cost: an extra process and
  a transport contract — accepted, because the control seam is what the
  assignment grades.
- **HTTP API + WebSocket control channel, not shared-DB polling** (D-041).
  Handoff requires live bidirectional control of one running session;
  polling a shared SQLite cannot express ownership transfer.
- **Accessibility-tree-first computer use** (D-039). Discovery observes
  `page.ariaSnapshot()` (YAML a11y tree) + a screenshot, decides with one
  structured call per step (AI SDK v7 `generateText` + `Output.object`
  against a fixed zod action vocabulary), and acts through Playwright
  `getByRole`. The a11y tree is more stable than markup and exists on legacy
  web and desktop surfaces alike; screenshots keep situational awareness
  without ever recording coordinates.
- **One model, used sparingly.** Discovery and distillation ran on
  `google/gemini-2.5-flash` via OpenRouter (vision + structured output, low
  latency, negligible cost): one structured call per discovery step, one
  more to distill, zero on replay.

The through-line: `goal → discovery (model in the loop) → artifact (typed
contract) → replay (no model) → structured result`, with policy enforced and
evidence captured at every step.

# Artifact schema

The artifact (`apps/engine/src/artifact.ts`) is the center of the design —
the contract between the discovery model, the human reviewer, the replay
executor, and the calling agent. All validation is zod; every type is
`z.infer`; no replay code is capability-specific.

- **Identity and provenance:** stable `id`, semver `version`, `goal`,
  `targetApp`, `risk` (`safe` | `risky`), `createdAt`, plus `discoveryModel`
  and `discoveryRunId` so every artifact audits back to a genuine run.
- **Typed I/O:** `inputs` (string/number/boolean/enum with allowed values,
  required flags, descriptions) and `outputs` — a capability reads like a
  function signature, because that is how the calling agent treats it.
- **Ordered steps** from a fixed action vocabulary
  (`navigate|click|type|select|press|wait|extract`), each with a
  reviewer-facing `intent`, `{{input}}` placeholder substitution, and an
  optional per-step `checkpoint`. `extract` steps fill declared outputs
  (element text, input value, or a regex capture from visible page text).
- **Strategy-tagged locators with fallbacks, as a strict schema.** Every
  step target records a primary `a11y` locator (role + accessible name,
  exact match), the other observed locators (`css`, `text`) as ordered
  fallbacks, and a human-readable `robustness` note explaining *why* the
  target should survive UI drift. The locator schema is a strict
  discriminated union on `strategy` — each variant requires its own
  nonempty fields and rejects foreign keys, so a malformed legacy locator
  like `{strategy: "text", value: "…"}` (which once shipped in a probe
  artifact) is now rejected at parse time instead of silently never
  matching. Pixel coordinates are never recorded — they do not survive
  restyling, and restyling is the common case across tenants sharing a
  vendor product.
- **Machine-checkable checkpoint** (URL regex and/or visible text and/or
  required element) asserted at the end of replay — the run proves it
  arrived instead of assuming the last click worked.
- **`businessOutcomes` detect table:** named, expected outcomes
  (`member_not_found`, `invalid_input`, `session_expired`) with URL/text
  detect rules, so "no such member" is a legitimate answer the caller
  branches on — not a crash. Per-step `suppressOutcomes` keeps a detect
  string that also matches an intermediate page from firing early.

Why shaped this way: the artifact must be reviewable by a human and
invocable by an agent at the same time. Discovery stamps `1.0.0` with
`reviewed: false`; a documented human review pass fixes the distiller's
first-draft semantics (the distiller is a good drafter, not a finisher — it
originally bound a balance cell by its value and turned the `done` signal
into a click step) before `reviewed: true` and a version bump. The two
graded artifacts (`evidence/artifacts/`) carry that review pass.

# Determinism & error handling

Replay (`apps/engine/src/replay.ts`) makes **zero model calls**. It resolves
each target by the primary a11y locator, then the recorded fallbacks **in
recorded order** — an explicit per-candidate probe, not Playwright's
`locator.or(...).first()` union, which would merge matches in DOM order and
let a higher-up fallback silently beat the primary; validates inputs against
the declared contract (enum membership, required fields) before acting;
substitutes `{{input}}` placeholders; extracts each declared output and
**coerces + validates it against the declared output contract** (unknown
outputs rejected, every declared output required, string/number/boolean/date
honestly converted); checks business outcomes after each step; and asserts
the checkpoint at the end. The artifact schema also enforces per-action
required step fields and unique input/output/outcome names, so a malformed
artifact fails at parse time, not mid-run. Policy (URL + action allowlists)
is re-checked before every navigation and every action, because the page may
have moved.

Every run ends in a structured result (`src/results.ts`) — never a thrown
exception for an expected runtime condition:

- **`success`** with the typed outputs;
- **`business_outcome(code, detail)`** — an expected answer. Detect rules
  fire after each step and in a fast pre-checkpoint probe, and a matched
  outcome *wins over* a failed step checkpoint: a validation error
  re-renders the form with HTTP 200, so the form-resubmission checkpoint
  failing is the symptom, `invalid_input` is the answer;
- **`recoverable`** — a transient condition was retried up to its policy
  (per-step attempts, plus bounded reload-and-redrive) and classified,
  not hidden;
- **`hard_failure(step, expected, observed, evidenceDir)`** — stops the run
  with a debuggable contrast plus a screenshot and aria snapshot on disk.

The exceptional states are handled deliberately, because the target produces
them for real: a transient 500 every 7th GET triggers `transient-reload`
(reload the idempotent GET-rendered page, re-drive the step, bounded by
`policy.transientErrorMaxReloads` — a failed POST is never blindly
repeated); browser-native confirms are answered per
`policy.dialogHandling` in discovery *and* replay (without the handler,
Playwright dismisses the confirm and the submit silently cancels) and logged
as `dialog` steps; session expiry is a modeled `session_expired` outcome.
Determinism is demonstrated, not asserted: the repeat replay after a fresh
reset returned byte-identical `{accountNumber: "7100070001",
confirmationNumber: "CNF-5001"}` (run `ae08c02b-…`), and the recovery probe
(run `4fa295db-…`) shows `transient-reload` firing in `steps.jsonl`. UI
drift is secondary by design (stable enterprise UIs): the a11y-primary +
fallback locator order absorbs restyling, and when it cannot, a hard
failure's expected/observed contrast is the drift signal.

# Heterogeneity & multi-tenant

The seam between *perceiving/acting on a surface* and *the recorded flow* is
the strategy-tagged locator: artifacts record **what** an element is (role +
accessible name), never **how one driver found it** (no coordinates, no
driver-specific handles). Replay's only surface-specific code is the small
`toLocator` mapping from strategy to driver. A legacy web app needs no
schema change — the mockbank is exactly that case (nested tables, no test
IDs) and a11y locators hold because real `<a>`/`<button>`/`<input>` elements
still expose roles and names. A desktop app extends the same seam: OS
accessibility APIs expose role+name trees too, so a desktop driver would
implement the same locator vocabulary; the fixed action vocabulary is the
deliberate guardrail that keeps artifacts portable and reviewable.

For multi-tenant reuse, artifacts are parameterized by construction — typed
inputs, `{{input}}` placeholders, a declared `targetApp` — and the points
where per-tenant configuration, branding, and version drift concentrate
(detect strings, checkpoints, specific target bindings) are data in the
artifact, not code. The intended model is a base artifact per vendor product
with a per-tenant override layer (rebind `targetApp`, patch individual
targets or outcome detect rules, bump the version, re-review), rather than
a re-recording per tenant; versioned artifacts plus the `reviewed` gate are
the specialization workflow. Drift detection is the replay contract itself:
fallbacks absorb small drift, and a hard failure's expected/observed +
screenshot is the rebind signal. Canonical URL parameterization and
apply-to-a-second-variant proof are named stretch directions, not built
(Section: Cuts).

# Escalation & handoff

Stuck detection has two forms. In discovery, the model reports `stuck` with
a reason (or step/time limits fire). In replay, a step that exhausts its
attempts with no matching business outcome escalates — bounded to one
handoff per step so a run cannot loop on human attention. The engine raises
a persisted intervention carrying the capability/goal, the failing step, the
reason, and the current state, with the failure screenshot + aria snapshot
written to the run evidence; it broadcasts `intervention-requested` over the
control channel, and the console's `/admin/interventions` inbox surfaces it.

Control transfer works on **the same live session**, through an explicit
ownership state machine (`src/session.ts`): `pause` stops automation from
issuing actions, `cede` passes ownership to a named operator, `resume`
returns it. Automation awaits ownership before every action; a stuck run
waits for the human up to `policy.handoffTimeoutMs` (default 20 minutes)
before failing with "operator did not resume". The operator reads live state
(`GET /sessions/:runId/state`: owner, URL, aria snapshot, screenshot,
control log) and performs real manual actions on the same page
(`POST /sessions/:runId/action`, human-owned only); every control transition
and every human action is recorded in the run evidence and the session
control log.

This is proven, not described: run `30b5f038-…` replayed a proof-only
artifact copy whose step-6 PRIMARY a11y locator was seeded stale (the
pre-rename label "Member summary"). Its recorded fallback never fired — it
was the malformed legacy shape `{strategy: "text", value: "…"}` that the
strict locator schema now rejects — so the step genuinely exhausted every
attempt with no matching outcome. The engine raised the stuck intervention
with screenshot + aria, paused, and waited; the operator sent `pause` →
`cede` over `/ws`, read the live state, clicked the real "View member" link
on the same page via the action endpoint, and sent `resume`. The run
re-drove the step (which now passed — the human had landed it on the right
page), extracted all three outputs, finished `success`, and the
intervention auto-resolved with the operator's identity and note. Handoff
evidence: `intervention.json`, `control.json`, `handoff-step-6.png/.yml`,
and the `human-action` entries in `steps.jsonl`. The honest read: this run
proves the *control-transfer and recovery* path (a human unsticking a run
automation could not), not a fallback saving the day.

# Safety

Guardrails live in `src/policy.ts` and are enforced on every execution path,
in discovery and replay alike (D-043, D-045, D-047):

- **Configurable allowlist.** `allowedUrlPatterns` (regex) and
  `allowedActions` (from the fixed vocabulary) gate every navigation and
  every action; violations are `PolicyViolationError`s that end the run.
- **Risk classes with conservative defaults.** Capabilities are `safe` or
  `risky`; actions outside the safe set and the whole `risky` class require
  an approval token, and `requireReviewForRisky` refuses to replay an
  unreviewed risky artifact at all — review is an INDEPENDENT gate, not an
  approval substitute: an approval token authorizes one run of a REVIEWED
  artifact and cannot bypass a missing review. Review state is authoritative
  in a DB column (the embedded artifact flag is a snapshot), and re-saving
  an artifact cannot silently strip a review another version earned. Native
  dialogs — the legacy risky-submit gate — are answered per explicit
  operator policy, never silently.
- **Segregated approval (maker ≠ checker).** A risky invocation creates an
  `awaiting_approval` run with zero steps executed and records
  `requestedBy`; a *different* operator decides (`decidedBy` is required and
  persisted with timestamp and reason; a coinciding requester/decider is
  detected and flagged `selfApproved`). Approval issues a one-time token
  scoped to that capability and consumed by exactly one run
  (`consumedByRunId`); the engine verifies the scope and
  single-use constraint server-side and starts the run itself. The approval
  also **pins the immutable artifact**: the request records the artifact
  `version` + a SHA-256 content hash, and at approval time the engine
  resolves that exact version and re-verifies the hash — the run executes
  the artifact the operator actually approved, never a mutated or replaced
  "latest" (a mismatch answers 409). Token consumption is an atomic
  conditional update, so two approvals cannot both start a run off one
  token. Proven in run `c48ffa84-…`
  (`proof-requester@…` requested, `proof-operator@…` approved,
  `selfApproved: false`).
- **Redaction of regulated data.** Everything persisted — step logs,
  transcripts, results, intervention records, API responses — flows through
  `redactText`/`redactValue`: API keys, bearer tokens, SSNs, card-shaped
  numbers, and `password=`/`token=`-style key-values are scrubbed, and
  JSON keys that look secret are replaced wholesale. The approval token in
  the proof run's record reads `[REDACTED]`.

Limits, honestly: the allowlist is regex-based (a permissive pattern is a
permissive policy); redaction is pattern-based — it catches secret/*shaped*
values, not arbitrary semantic PII; and the demo target holds only fictional
seed data, so no real member PII ever entered the system.

# Cuts

Deliberate omissions, each traded for depth elsewhere:

- **The target is demo infrastructure.** Mockbank has zero dependencies and
  no automated tests; it simulates hostility (tables, latency, transient
  500s, session expiry, native confirm) but is not a real legacy app. This
  keeps evidence runs local, deterministic, and free of credentials, PII,
  and terms-of-service exposure.
- **No structured 5xx retry in the discovery loop.** Discovery survives the
  target's every-7th-GET 500 only via the model's own retry choice (it
  retried in every graded run); replay has the structured `transient-reload`
  path. Moving the same bounded retry into the loop is the next fix.
- **Distillation is one pass plus human review.** Outcome detect rules are
  live-probed against the app, but target bindings are not re-validated
  after distillation; a second, self-validating distillation pass (probe the
  draft's locators against the live page) is future work, and today the
  human review pass is what closes that gap.
- **No evidence-binary endpoint.** Hard failures surface `evidenceDir` (a
  path on the engine host); the console renders a path hint rather than
  serving screenshots/aria over HTTP.
- **Dev-simple transport trust model.** The engine's HTTP API and WS have no
  auth of their own; the auth boundary is the frontend's better-auth session
  on `/api/engine/*`, and the browser reaches `/ws` directly. Production
  needs engine-side auth and a WS proxy or signed session grants.
- **No real-time co-browsing.** The operator works from polled state
  snapshots plus discrete actions on the live page (the assignment's scope
  note allows this); a live mouse/keyboard mirror over the same session is
  the designed-for but unbuilt next step.
- **No pixel-sensitive screenshot guarantee.** Evidence screenshots/aria
  snapshots are captured best-effort at failure/handoff time; because the
  target injects random latency and a transient 500 cadence, two runs of the
  same flow do not produce byte-identical images. Determinism is claimed for
  the structured RESULT (outputs, outcome codes), never for the visual
  artifacts.
- **CLI replay is operator-invoked.** It passes `approved: true` implicitly
  and reads artifacts from the local evidence dir; the segregated approval
  flow lives on the HTTP path.
- **Stretch goals not built:** multi-tenant override storage and
  cross-variant proof, desktop drivers, replay-N stability scoring,
  draft→approved capability gating, and bounded LLM assisted-fallback on
  replay failure. The engine has no automated test suite — verification was
  by executed runs, all preserved under `/evidence/`.
