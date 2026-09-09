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
| `replay-transient-500-recovery--4fa295db-…` | The target answers every 7th authenticated GET with a transient HTTP 500 ("Core system unavailable"). `steps.jsonl` shows the engine detect it (`transient-reload`), reload, and re-drive the step. |
| `replay-open-sub-account-repeat-deterministic--ae08c02b-…` | Second happy-path run after a fresh reset returns **identical** `{accountNumber: "7100070001", confirmationNumber: "CNF-5001"}` — deterministic replay + deterministic target counters. |

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
