# engine — implementation notes (for the decision ledger)

## Model

Discovery + distillation ran on **`google/gemini-2.5-flash`** via OpenRouter
(vision + structured output, ~$0.30/$2.50 per Mtok). Chosen from the live
OpenRouter catalog for: image input, tool/structured-output support, low
latency, negligible cost. One structured call per discovery step; one more
for distillation; zero on replay.

## Verified evidence (this machine, 2026-09-08/09)

| Run | Target | Result | Evidence |
| --- | --- | --- | --- |
| `a1906e74-…` discovery | mockbank build @ `394a046` | success, 7 steps (login → search → detail) | `evidence/runs/a1906e74-c85d-4a63-bb74-22edb4ad0ded/` |
| `5ac89098-…` discovery | own fixture :4523 | success, 4 steps, distilled artifact | `evidence/runs/5ac89098-4cd4-415e-9370-54fc37399340/`, `evidence/artifacts/get_member_balances.json` |
| replay `fafb5532-…` | fixture | success, outputs `{$12,480.55, $1,204.10}` | `evidence/runs/fafb5532-1ccb-4897-94e2-70220cbeb243/` |
| replay `0fe45f69-…` | fixture | `business_outcome: member_not_found` | `evidence/runs/0fe45f69-0350-43e4-abfc-567bb8ad1d11/` |

The mockbank discovery was a smoke run against an UNFINISHED sibling build;
mockbank-worker asked me off port 4010 while they iterate. Final graded
evidence runs against the finished mockbank happen at integration time.

## Decisions worth recording

1. **Artifact schema is zod-only, types via `z.infer`.** Targets are
   strategy-tagged locator lists (`a11y` primary + `css`/`text` fallbacks),
   never coordinates. `memberId` inputs, typed outputs, a checkpoint, and a
   `businessOutcomes` detect table make the artifact self-describing for
   both reviewers and calling agents.
2. **Replay bootstraps to `targetApp`** when the artifact's first step is
   not a `navigate` — without this, replays started on `about:blank` and
   timed out (found by the first real replay).
3. **`done`/`stuck` are loop-control signals, not page actions**, so the
   action allowlist does not apply to them (the allowlist governs real UI
   interactions only).
4. **AI SDK v7:** structured output is `generateText` + `Output.object`
   (`generateObject` is deprecated); screenshots go as `file` parts with
   `mediaType: "image/png"` (the `image` part is deprecated).
5. **The distillation model writes a good first draft, not a final
   artifact.** It correctly inferred inputs/outputs/risk but bound a
   balance cell by its VALUE as the a11y name and turned loop-control
   (`done`) into a click step. The artifact schema validates structure;
   semantic review (human pass before `reviewed: true`) fixes target
   quality. The checked-in demo artifact carries that review pass.
6. **Policy:** URL allowlist + action allowlist enforced in BOTH discovery
   and replay; risky capabilities/actions need an approval token (issued by
   `POST /approvals/:id/approve`). CLI replay passes `approved: true`
   (operator-invoked). Redaction scrubs API keys, bearer tokens, SSNs,
   card-shaped numbers, and `password=…` style values from all persisted
   evidence.
7. **Ports:** engine dev server uses `ENGINE_PORT` (default 4011). Local
   runs here used 4177 because the mockbank sibling is binding several
   ports while under construction.
8. **better-sqlite3** needed no `allowBuilds` addition (already present);
   the Chromium binary installs via
   `pnpm --filter engine exec playwright install chromium` (postinstall
   does not auto-download, and pnpm did not warn).

## Open issues for the frontend integration phase

- `/replay` approval check accepts any approved token (not yet scoped to
  capability/run); tighten when multi-user segregation lands.
- `LiveSession` registry exists but runs create their own browser contexts
  today; full pause/cede/resume integration (runs operating on registered
  live sessions) is the next phase with the operator console.
- Discovery runs via the server don't yet use `LiveSession` either; WS
  step events stream for replay only.
- The engine DB is created in the CWD-relative `data/`; runs should set
  `ENGINE_DB_PATH`/`ENGINE_EVIDENCE_DIR` explicitly in production.
- Artifact distillation quality improves with a second distillation pass
  that validates targets against the live page (self-healing draft).

## Final graded runs (integration, 2026-09-09, against the FINISHED mockbank)

Discovery + distillation model: **`google/gemini-2.5-flash`** via OpenRouter
(unchanged). Every run below followed `POST /__reset__`. The reviewed
artifacts and all run logs are copied into the repo-root **`/evidence/`**
bundle (see its README for the index).

| Capability | Run | Result |
| --- | --- | --- |
| `get_member_balances` | discovery `c1ee290a-44ea-4c01-9992-750f78382933` | success, 7 steps, distilled + reviewed |
| | replay happy `53d839f5-b835-4461-96bf-1364cb970127` | success, outputs `{$12,480.55, $1,204.10, "Margaret Ellison"}` |
| | replay exceptional `f74d1b6d-48bd-40f5-b6b3-f2180ec2df0a` (memberId 999999) | `business_outcome: member_not_found` |
| `open_sub_account` | discovery `f1ae0424-82b1-4aa3-ab17-78045d9ebe97` | success, 12 steps incl. checkbox + native confirm |
| | replay happy `a7b6c89d-f46c-4add-979c-faf6c03d6c1a` | success, `{accountNumber 7100070001, confirmationNumber CNF-5001}` |
| | replay exceptional `15f044f6-aab3-4599-a6d3-18d37ff99856` (deposit -50) | `business_outcome: invalid_input` |
| | replay repeat `ae08c02b-1129-45a1-9a85-9c6126c0a7b7` | success, identical `7100070001`/`CNF-5001` (deterministic) |
| transient recovery probe | replay `4fa295db-13c5-4b29-b66e-f333198e116d` | `transient-reload` fired on the every-7th-GET 500, page reloaded, step re-driven |

### Engine fixes made at integration (each its own commit)

1. **Native dialogs.** New `src/dialogs.ts` attaches a policy-driven
   (`policy.dialogHandling`, default `accept`) `page.on("dialog")` handler in
   BOTH discovery and replay; every handled dialog is logged as a `dialog`
   step. Without a listener Playwright dismisses confirms, which silently
   canceled the sub-account submit.
2. **Transient-5xx recovery (replay).** The last main-document response
   status is tracked; a >=500 answer makes the step loop reload the
   idempotent page (bounded by `policy.transientErrorMaxReloads`, logged as
   `transient-reload`) and re-drive the step.
3. **Distillation grounding.** The distiller now receives the terminal
   page's visible text plus business-outcome rules PROBED against the live
   app (`/search/results?q=0-unknown-member`, `/session-expired`); verified
   probes win over model guesses. Distill failures are logged to evidence
   instead of swallowed (this is how the first silent failure was found).
4. **Extraction.** `page-text-match` matches against whitespace-normalized
   text (legacy table cells render as newlines) and returns the LAST capture
   group (earlier groups are anchors like the nickname column).
5. **Business outcomes vs failed steps.** A matched business outcome wins
   over a failed step checkpoint (validation errors re-render the form with
   HTTP 200); new optional per-step `suppressOutcomes` guards the healthy
   path from detect strings that also match intermediate pages; a
   pre-checkpoint probe fails fast (`BusinessOutcomeInterrupt`) instead of
   waiting out the timeout.
6. **Re-fill suppression.** Inputs typed by an earlier successful step are
   not retyped when a re-rendered page re-drives the flow (the app echoes
   submitted values back).
7. **Policy gate.** An UNREVIEWED risky capability without an approval token
   is refused (`policy.requireReviewForRisky` is now actually enforced).
8. **Optional inputs** substitute empty when omitted (required ones are
   still caught by `validateInputs`).

### Artifact review passes (the "human review" both artifacts carry)

- `get_member_balances`: renamed credential inputs to `tellerUsername`/
  `tellerPassword` and made them optional (the demo target accepts any
  credentials); rebound balance extraction per account TYPE (the draft keyed
  on the seeded nickname literal); removed `{{memberId}}` placeholders from
  the checkpoint (the executor does not substitute there); added per-step
  checkpoints + CSS form-name fallbacks; added a `memberName` output.
- `open_sub_account`: added the `accountType` enum input + a real `select`
  step (the draft hardcoded "savings"); added the missing login `navigate`
  step; replaced the draft's single-occurrence confirmation-URL checkpoint
  (`c=CNF-5001`) with the stable `/confirmation?c=CNF-\d+` shape; tightened
  `invalid_input` detect to the actual error sentence ("cannot be negative")
  so it does not match the healthy form; added `invalid_input` +
  `session_expired` outcomes and `suppressOutcomes` on the review step.

### Remaining gaps (for REPORT.md)

- Discovery runs the target's 500-page recovery only via the model's own
  retry intuition; there is no structured 5xx retry in the discovery loop
  (replay has one). A discovery run that hits the 7th-GET 500 relies on the
  model choosing to retry — it did in every run here.
- `member_not_found` on `open_sub_account` fires via the shared detect text;
  the member-form 404 variant ("No member exists with ID") is also covered
  by the same text.
- Approval tokens are still not scoped per capability/run (server-side).

## Module imports: `@/` alias (2026-09-09, owner direction)

Owner direction: replace the NodeNext `./x.js` relative imports with an
`@/` path alias ("`@/db` instead of `./db.js`"). Every same-package import
in `src/` is now extensionless `@/<name>`; `node:` and bare package
specifiers are unchanged.

How it stays runnable under `module: NodeNext` (the reason the `.js`
extensions existed):

- **`tsconfig.json`** maps `"@/*": ["./src/*.js"]`. The `.js` in the
  *mapping* (not in the imports) is deliberate: under NodeNext ESM
  resolution TypeScript does NOT append extensions to extensionless
  path-mapped candidates, but a candidate ending in `.js` gets the normal
  `.js`→`.ts` source substitution, so `@/db` typechecks to `src/db.ts`.
- **`tsc` build** emits `dist/` with the alias verbatim, so the build
  script runs **`tsc-alias`** after `tsc` (`build`: `tsc -p tsconfig.json
  && tsc-alias -p tsconfig.json`), which rewrites `@/db` back to the
  relative `./db.js` Node ESM needs. Verified: `node dist/index.js` boots
  and answers `/health`.
- **`tsx` dev** (`dev`, `discover`, `replay` scripts) honors tsconfig
  `paths` with the same `.js`→`.ts` substitution, so `@/db` resolves to
  the source file directly. Verified: `tsx src/index.ts` boots.

Alternatives considered: a `package.json` `imports` map (requires `#`-prefixed
specifiers, not `@/`) and dropping NodeNext for bundler resolution (would
stop catching missing-extension mistakes the service still needs at Node
runtime). `tsc-alias` is the least-ugly mechanism that keeps both runtimes
honest.
