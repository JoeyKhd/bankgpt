# /evidence/ — graded demonstration bundle

This bundle demonstrates the end-to-end flow required by the assignment
(§"Deliverables" #3): a genuine LLM-driven **discovery** run distilled into a
saved **capability artifact**, plus deterministic **replay** runs — a happy
path and exceptional states — against the live proxy target, **FinCore
Teller** (`apps/mockbank`, a zero-dependency mock back-office banking console
on `http://127.0.0.1:4010`).

Everything here was produced by real runs. Nothing was scripted into the
artifacts: the discovery model (`google/gemini-2.5-flash` via OpenRouter)
drove a live Chromium through Playwright, observing the accessibility tree +
screenshots, one structured model call per step. Replay makes **zero** model
calls.

## Target

```sh
pnpm --filter mockbank dev          # FinCore Teller on 127.0.0.1:4010
curl -X POST http://127.0.0.1:4010/__reset__   # before every run (deterministic seed)
```

## Capabilities (artifacts)

| File | Risk | What it proves |
| --- | --- | --- |
| `artifacts/get_member_balances.json` | safe | Log in → search member → open detail → read savings & checking balances. Reviewed (`reviewed: true`). |
| `artifacts/open_sub_account.json` | risky | Log in → member → open savings sub-account with an initial deposit → tick the authorization checkbox → **native `window.confirm` accepted per policy** → reach the confirmation screen and read the account + confirmation numbers. Reviewed. |
| `artifacts/get_member_balances__handoff-probe.json` | safe | **Proof-only** copy of `get_member_balances` with step 6's locator seeded stale (pre-rename label "Member summary") so the run gets genuinely stuck and escalates — used ONLY by `stuck-takeover-get-member-balances--…`. The canonical artifact is untouched. **Correction (D-049):** its fallback is the malformed legacy shape `{strategy: "text", value: "Member summary"}` — `value` is not a locator field, so the fallback never matched; the stale a11y primary (the pre-rename label) is what made the run stuck, and the human's click is what un-stuck it. The current strict locator schema (src/artifact.ts) rejects this shape; the file is kept byte-identical as graded-run history. |

## Runs

Each `runs/<label>--<runId>/` holds `steps.jsonl` (one redacted JSON object
per step: action, target, the model's/recorded **reason**, duration, result),
`result.json` (the structured result), `transcript.json` (discovery only —
the full redacted model transcript), and failure screenshots/snapshots where
relevant.

### Discovery (genuine LLM-driven)

| Directory | Outcome |
| --- | --- |
| `discovery-get-member-balances--c1ee290a-…` | success, 7 steps, distilled `get_member_balances`. |
| `discovery-open-sub-account--f1ae0424-…` | success, 12 steps incl. the checkbox + native confirm dialog (see the `dialog` step in `steps.jsonl`), distilled `open_sub_account`. |

### Replay — happy paths (zero model calls)

| Directory | Outcome |
| --- | --- |
| `replay-get-member-balances-happy--53d839f5-…` | `success`, outputs `{memberName: "Margaret Ellison", savingsBalance: "$12,480.55", checkingBalance: "$1,204.10"}`. |
| `replay-open-sub-account-happy--a7b6c89d-…` | `success`, outputs `{accountNumber: "7100070001", confirmationNumber: "CNF-5001"}`; native confirm auto-accepted and logged. |

### Replay — exceptional states

| Directory | Outcome |
| --- | --- |
| `replay-get-member-balances-member-not-found--f74d1b6d-…` | `business_outcome: member_not_found` — unknown ID is a legitimate answer, not a crash (HTTP 200 on the target). |
| `replay-open-sub-account-invalid-deposit--15f044f6-…` | `business_outcome: invalid_input` — a negative deposit re-renders the form with "Initial deposit cannot be negative."; the engine reports the outcome instead of a step failure. |
| `replay-transient-500-recovery--4fa295db-…` | The target answers every 7th authenticated GET with a transient HTTP 500 ("Core system unavailable"). `steps.jsonl` shows the engine detect it (`transient-reload`, reload 1/3) and re-drive the step. Note: the saved `result.json` for this probe run is **`hard_failure`** — the probe navigated back to the dashboard to force extra GETs and trip the 7th-GET 500, and the re-driven click then timed out on a page the flow was no longer on; the recovery MECHANISM (detect → `transient-reload` → re-drive) is what this run evidences, not a green run. |
| `replay-open-sub-account-repeat-deterministic--ae08c02b-…` | Second happy-path run after a fresh reset returns **identical** `{accountNumber: "7100070001", confirmationNumber: "CNF-5001"}` — deterministic replay + deterministic target counters. |

### Approval segregation + live-session take-over (D-047 proof runs)

Genuine runs against the live engine server (`pnpm --filter engine dev`,
Hono HTTP + `/ws` control channel) after `POST /__reset__`, driven over the
real HTTP API and WebSocket — nothing scripted into the target. Each run
folder also holds its `intervention.json` (the persisted decision record)
and `control.json` (the session ownership log).

| Directory | Outcome |
| --- | --- |
| `approval-segregation-open-sub-account--c48ffa84-…` | The requester (`proof-requester@bankgpt.demo`) raised a request-first approval for the risky `open_sub_account` (`POST /approvals` → 201, run `awaiting_approval`, zero steps executed). A **different** operator (`proof-operator@bankgpt.demo`) approved (`intervention.json`: `selfApproved: false`, scoped one-time `approvalToken` redacted, `consumedByRunId` = the run). The engine started the run itself; it completed `success` with `{accountNumber: "7100070001", confirmationNumber: "CNF-5001"}`. `steps.jsonl` carries the audit `approval` entry (`approved by proof-operator@bankgpt.demo …; run started`). |
| `stuck-takeover-get-member-balances--30b5f038-…` | Step 6 ("Open the member detail page") failed all attempts against a seeded stale locator (`artifacts/get_member_balances__handoff-probe.json` — the pre-rename link label "Member summary"; the target's link is "View member"). The engine raised a `stuck` intervention with screenshot + aria (`handoff-step-6.*`), paused, and waited. The operator sent `pause` + `cede` over `/ws` (`control.json`: `paused` → `ceded to proof-operator@…`), read the live state (`GET /sessions/:runId/state`), performed a REAL manual step on the SAME page (`POST /sessions/:runId/action` click link "View member" — recorded as a `human-action` in `steps.jsonl` and `control.json`), then sent `resume`. The run re-drove the step (which now passed because the human had navigated to the member detail page), extracted all three outputs, and finished `success`; the stuck intervention resolved to `resolved` with the operator's handoff note. **Precision (D-049):** the probe artifact's recorded fallback was the malformed `{strategy: "text", value: "Member summary"}` (see the artifacts table) and could never match; the stuck was caused by the stale a11y PRIMARY, and recovery came from the operator's real click — not from a fallback firing. That is the honest handoff proof this run demonstrates. |

These prove the two segregation-of-duties paths: **maker ≠ checker** for
risky actions, and **automation ↔ human hand-off** on one live session with
every control transition and manual step in the run evidence.

## Commands that produced these

```sh
# discovery (genuine, LLM-driven)
pnpm --filter engine discover \
  --goal "Log in to the teller console and read member 100231's savings and checking balances" \
  --target http://127.0.0.1:4010
pnpm --filter engine discover \
  --goal "Open a new savings sub-account for member 100231 with an initial deposit of 250 and reach the confirmation screen" \
  --target http://127.0.0.1:4010

# replay (deterministic, zero model calls)
pnpm --filter engine replay --capability get_member_balances --input memberId=100231
pnpm --filter engine replay --capability get_member_balances --input memberId=999999
pnpm --filter engine replay --capability open_sub_account \
  --input memberId=100231 --input accountType=savings --input initialDeposit=250
pnpm --filter engine replay --capability open_sub_account \
  --input memberId=100231 --input accountType=savings --input initialDeposit=-50
```

`POST /__reset__` ran before each run so account/confirmation counters and
the transient-500 cadence are deterministic. Discovery requires
`OPENROUTER_API_KEY` (kept out of evidence; redaction scrubs keys, tokens,
SSNs, and card-shaped numbers from everything persisted).

## Redaction / secrets

The engine redacts API keys, bearer tokens, SSNs, card-shaped numbers, and
`password=…`-style values before persisting. The only credentials present in
transcripts are the mock's own demo values (`testuser`) — FinCore Teller
accepts any sign-in by design and stores nothing.

## Human review

Both artifacts carry `reviewed: true` after a human review pass that fixed
the distiller's first-draft semantics (per-type balance extraction,
placeholder-free checkpoints, a precise `invalid_input` detect string). The
review details are in `apps/engine/NOTES.md`.
