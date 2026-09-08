# Thought process: decision ledger

## Purpose

Keep a timestamped record of project decisions, changes, and their concise
reasons. This is a decision ledger, not a raw transcript or a stream of private
reasoning. Record outcomes, relevant constraints, trade-offs, and evidence that
someone reviewing the project can verify.

The [assignment](context/assignment.md) asks us to explain and defend our choices
and cuts in `/REPORT.md`. It does **not** explicitly require a separate ledger.
This file is a project convention requested by the project owner. It supports,
but does not replace, the report or the runtime evidence in `/evidence/`.

## How to maintain this ledger

- Append an entry for each meaningful decision, fix, or change. Include the
  ledger update in the same commit as the related change where practical.
- Use the actual entry time in UTC, in ISO 8601 format (`YYYY-MM-DDTHH:MM:SSZ`).
  Do not invent dates for earlier work. Identify retrospective entries as such.
- Give each entry a stable ID and a status, such as `accepted`, `deferred`, or
  `superseded`. Do not present proposals as agreed decisions.
- State what changed, why, and any important consequence, limit, or follow-up.
  Cite source files or verified results where useful. Record alternatives only
  when they were actually considered.
- Preserve history. If a decision changes, append a new entry referencing the
  earlier ID rather than silently rewriting the old decision. Correct factual
  errors transparently.
- Keep secrets, credentials, tokens, sensitive personal data, and raw model
  transcripts out of this file. Use concise decision summaries, not private
  working notes.
- The initial entries below describe this documentation work only. They do not
  reconstruct earlier repository activity or select an implementation approach.

### Entry template

```markdown
### D-NNN — YYYY-MM-DDTHH:MM:SSZ — Short title

- **Status:** accepted | deferred | superseded
- **Decision/change:** What was agreed, changed, or explicitly left open.
- **Why:** Concise rationale and the relevant requirement or constraint.
- **Consequences/follow-up:** Limits, trade-offs, or next actions, if any.
- **References:** Source files, related entry IDs, or verification results.
```

## Entries

### D-001 — 2026-09-08T19:25:27Z — Define the product without choosing the implementation

- **Status:** accepted
- **Decision/change:** Add `what-we-are-building.md` as a source-backed product
  and scope brief. Capture required behavior, constraints, completion criteria,
  deliverables, and evaluation priorities without selecting implementation
  technologies or mechanisms.
- **Why:** The project owner requested a shared description of what we are
  building and will explain how to build it later. The assignment requires a
  complete end-to-end slice but leaves the implementation choices open.
- **Consequences/follow-up:** Implementation decisions remain deferred. Examples
  in the assignment are not adopted features or target choices. No external
  research was needed because the supplied context defines the assignment.
- **References:** `context/assignment.md` §§1–9, 11; `context/email.md`;
  project owner's documentation request; `what-we-are-building.md`.

### D-002 — 2026-09-08T19:25:27Z — Keep a timestamped decision ledger

- **Status:** accepted
- **Decision/change:** Add `thought-process.md` to record decisions and changes
  with timestamps, concise reasons, consequences, and references. Preserve
  earlier entries when later decisions replace them.
- **Why:** The project owner requested a ledger. The assignment expects us to
  explain trade-offs and defend the work, so a contemporaneous record will help
  prepare the required design report without inventing a history later.
- **Consequences/follow-up:** This is our documentation convention, not a stated
  assignment deliverable. It does not replace `REPORT.md`, execution logs, or
  evidence of a real discovery and replay run.
- **References:** `context/assignment.md` §§5–7, 9; project owner's documentation
  request.

### D-003 — 2026-09-08T19:30:17Z — Keep the product brief with its context

- **Status:** accepted
- **Decision/change:** Move the uncommitted product brief to
  `context/what-we-are-building.md` and update its relative links. Keep
  `thought-process.md` at the repository root.
- **Why:** The project owner clarified that the product brief belongs in
  `context/` and that the ledger can stay in its current location.
- **Consequences/follow-up:** This updates the location recorded in D-001, not
  the product scope. Future references should use the path under `context/`.
- **References:** Project owner's file-location clarification; D-001;
  `context/what-we-are-building.md`.

### D-004 — 2026-09-08T19:32:47Z — Make the documentation and commit workflow explicit

- **Status:** accepted
- **Decision/change:** Update `AGENTS.md` to reference
  `context/what-we-are-building.md` and `thought-process.md`, preserve the
  distinction between requirements and implementation choices, and require
  ongoing ledger entries plus focused commits with short emoji messages and
  GitHub pushes.
- **Why:** The project owner requested both references and a commit for each
  fix or change. Shared instructions keep future work aligned with the agreed
  scope and make the decision history easy to maintain.
- **Consequences/follow-up:** Future agents must wait for the owner's
  implementation direction, check relevant changes before committing, stage
  only related files, and report any push blocker rather than rewriting history.
- **References:** Project owner's documentation and commit requests; D-001–D-003;
  `AGENTS.md`. Documentation review found no substantive requirement or scope
  issues; all 11 relative Markdown links resolve and the first staged diff
  passed `git diff --cached --check`.

### D-005 — 2026-09-08T19:50:12Z — Adopt the owner's shared agent conventions

- **Status:** accepted
- **Decision/change:** Expanded `AGENTS.md` with the general conventions from
  the owner's other project: save taught conventions in the repo immediately,
  keep the focused emoji commit + push workflow with explicit commit-safety
  limits, prefer context7/tavily when available, verify markdown claims against
  code before acting, protect secrets, and keep `context/` a curated knowledge
  base.
- **Why:** The project owner asked for the same conventions here, keeping only
  what is relevant to this repository.
- **Consequences/follow-up:** Project-specific stack, brand, layout, and
  checklists from the other repository were deliberately excluded. No
  package manager, framework, or toolchain is prescribed yet; that stays open
  until the owner explains how this project will be built.
- **References:** Project owner's shared `AGENTS.md` conventions; D-004;
  `AGENTS.md`.

### D-006 — 2026-09-08T19:56:02Z — Record the frontend scaffold conventions

- **Status:** accepted
- **Decision/change:** The project owner added a Next.js + shadcn app at
  `apps/frontend` (standalone pnpm package with its own lockfile; Next.js
  16.2.6, React 19, Tailwind 4, shadcn `base-nova`/neutral, `@base-ui/react`,
  `lucide-react`, `next-themes` with `d` toggle, Geist fonts, `@/*` alias).
  `AGENTS.md` now records the verified layout, stack, package-manager,
  lint/format, definition-of-done, and code-style conventions for it.
- **Why:** With a real frontend scaffold present, the relevant conventions
  from the owner's other project apply and should live in the repo. Each claim
  was verified against the actual files (`package.json`, `components.json`,
  configs, scaffold layout), not copied from prose.
- **Consequences/follow-up:** EVM/Privy conventions stay out per the owner.
  No test runner exists yet; one joins the definition of done when added.
  TanStack/zod are recorded as the owner's not-yet-installed defaults, to be
  confirmed when the need arises. `apps/frontend` itself is still the owner's
  uncommitted work and was not staged with this change.
- **References:** Project owner's message; `apps/frontend/package.json`;
  `apps/frontend/components.json`; `apps/frontend/AGENTS.md`; D-005.
