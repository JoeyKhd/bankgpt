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
