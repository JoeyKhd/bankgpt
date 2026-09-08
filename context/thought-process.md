# Thought process: decision ledger

## Purpose

Keep a timestamped record of project decisions, changes, and their concise
reasons. This is a decision ledger, not a raw transcript or a stream of private
reasoning. Record outcomes, relevant constraints, trade-offs, and evidence that
someone reviewing the project can verify.

The [assignment](assignment.md) asks us to explain and defend our choices
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

### D-007 — 2026-09-08T19:59:08Z — Convert to a pnpm workspace monorepo

- **Status:** accepted
- **Decision/change:** Made the repository a pnpm-workspace monorepo per the
  owner's request. Root `package.json` (name `interface-ai`,
  `packageManager: pnpm@10.33.0`) + root `pnpm-workspace.yaml` cover `apps/*`
  with a single root `pnpm-lock.yaml`; the scaffold's nested
  `apps/frontend/pnpm-workspace.yaml` and `pnpm-lock.yaml` were removed, and
  its `allowBuilds` map moved to the root workspace file. Root scripts fan
  out: `pnpm run dev` starts the frontend via `pnpm --filter frontend run
  dev`; `build` / `lint` / `typecheck` / `format` run via `pnpm -r
  --if-present`. Root `.gitignore` now ignores `node_modules/`.
- **Why:** The owner needs `pnpm run dev` from the workspace root and a
  monorepo layout for future packages. The scaffold's embedded `.git` (one
  auto-generated "feat: initial commit", no remote) blocked a normal commit,
  so it was removed after backing it up to
  `/tmp/frontend-nested-git-backup.tar.gz`; the scaffold is now tracked in
  this repo as `ce8bf13`.
- **Consequences/follow-up:** Verified by execution: `pnpm install` from the
  root resolves 2 workspace projects with no config warnings; `pnpm run dev`
  from the root serves Next.js 16.2.6 on :3000 (HTTP 200); root `lint`,
  `typecheck`, and `build` all pass. `AGENTS.md` package-manager, layout, and
  definition-of-done sections updated to match.
- **References:** Project owner's monorepo request; `package.json`;
  `pnpm-workspace.yaml`; D-006.

### D-008 — 2026-09-08T20:01:12Z — Move the decision ledger into `context/`

- **Status:** accepted
- **Decision/change:** Moved `thought-process.md` from the repository root to
  `context/thought-process.md` (recorded by git as a rename) and updated all
  links and references in `AGENTS.md`, `context/what-we-are-building.md`, and
  this file.
- **Why:** The project owner prefers keeping all project knowledge together in
  `context/`; the ledger belongs with the product brief and source material.
- **Consequences/follow-up:** This supersedes the location recorded in D-003.
  Future references use `context/thought-process.md`. Historical entries
  mentioning the old root path are preserved as the record of what was true
  at the time.
- **References:** Project owner's request; D-003; `context/thought-process.md`.

### D-009 — 2026-09-08T20:40:59Z — Install and codify the TanStack + zod stack

- **Status:** accepted
- **Decision/change:** Installed the owner's standard frontend libraries into
  `apps/frontend`: `@tanstack/charts` 0.16, `@tanstack/react-query` 5.102,
  `@tanstack/react-form` 1.33, `@tanstack/markdown` 0.0.13, and `zod` 4.5.
  `AGENTS.md` now lists them as installed with the owner's usage conventions
  (charts scales/tooltip, query keys and invalidation, headless form, AST
  markdown, zod-everywhere validation), replacing the earlier
  "not installed yet" hedge.
- **Why:** The owner corrected the earlier deferral (D-006): these libraries
  are established conventions and belong installed, not described as pending.
  `AGENTS.md` should state what is true, verified against `package.json`.
- **Consequences/follow-up:** The convention text originally referenced a
  `@tanstack/react-markdown` package, which does not exist in the npm
  registry; the real renderer is `@tanstack/markdown`, so that is what is
  installed and documented. Verified: root fanned-out `pnpm typecheck`,
  `lint`, and `build` all pass with the new dependencies.
- **References:** Project owner's correction; `apps/frontend/package.json`;
  npm registry metadata; D-006.

### D-010 — 2026-09-08T20:44:40Z — Adopt better-auth with a gitignored SQLite database

- **Status:** accepted
- **Decision/change:** Added authentication with `better-auth` 1.7 on SQLite
  (`better-sqlite3` v12, the peer range better-auth pins). Files:
  `apps/frontend/lib/auth.ts` (email + password), `lib/auth-client.ts`,
  `app/api/auth/[...all]/route.ts`, `.env.example` (names only), and
  `data/.gitignore`. The SQLite file is `apps/frontend/data/app.sqlite`
  (override `DATABASE_URL`) and is gitignored via `data/.gitignore` plus
  `/data/*.sqlite*` rules in `apps/frontend/.gitignore`. SQLite is the app
  database for all data for now, not just auth.
- **Why:** The owner chose better-auth and SQLite for the whole app, and
  required the database file to stay out of git.
- **Consequences/follow-up:** Verified end-to-end: schema migration created
  the four auth tables; dev-server smoke test signed up a user, validated the
  session cookie, and signed in; smoke data removed afterward. `git
  check-ignore` confirms every `data/*.sqlite*` variant is ignored. All
  format/lint/typecheck/build checks pass. The CLI's migrate prompt needs a
  `y` confirmation when run manually.
- **References:** Project owner's request; better-auth docs (basic-usage,
  adapters/sqlite, integrations/next); `apps/frontend/.gitignore`; D-009.

### D-011 — 2026-09-08T20:48:34Z — Standardize local env setup

- **Status:** accepted
- **Decision/change:** Two related conventions per the owner. (1) Agents must
  create `apps/frontend/.env.local` whenever it is missing, filling correct
  values (generated `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` for dev).
  (2) `apps/frontend/.env.example` now marks each variable REQUIRED or
  OPTIONAL (`BETTER_AUTH_SECRET` required; `BETTER_AUTH_URL`, `DATABASE_URL`
  optional).
- **Why:** The owner asked for both, so a fresh checkout or session always has
  working local auth config without committing secrets.
- **Consequences/follow-up:** `.env.local` is gitignored (verified with `git
  check-ignore`) and was created in this change with a generated secret;
  `.env.example` remains the committed, value-free reference.
- **References:** Project owner's request; `apps/frontend/.env.example`; D-010.

### D-012 — 2026-09-08T20:57:10Z — Install project skills and document them in AGENTS.md

- **Status:** accepted
- **Decision/change:** Installed 18 project skills into `.agents/skills/`
  (tracked in `skills-lock.json`) with `npx skills add`, chosen against the
  skills.sh leaderboard and CLI search by stack fit, install count, and
  source reputation: `vercel-react-best-practices` + `web-design-guidelines`
  (official Vercel), `frontend-design` (official Anthropic), `shadcn`
  (official shadcn), `better-auth-best-practices` (official Better Auth),
  `tailwind-4-docs`, `tanstack-query` + `tanstack-form` + `zod` (unofficial;
  AGENTS.md conventions win on conflict), `pnpm` (antfu),
  `extract-design-system` (for the planned `DESIGN.md` extracted from the
  interface.ai company site), and the mattpocock workflow skills
  (`code-review`, `tdd`, `diagnosing-bugs`, `codebase-design`,
  `domain-modeling`, `research`, `prototype`). Added a `## Skills` section to
  `AGENTS.md` describing each skill's purpose, with the convention that
  adding or removing a skill requires updating that list in the same change.
  Gitignored `.claude/` (the CLI's Claude Code symlink dir).
- **Why:** The project owner asked for stack-matched skills, an AGENTS.md
  list describing what each is for, and a standing note that future skills
  must be described when added. Next.js 16 and Tailwind 4 are newer than
  model training data, so pinned docs/pattern skills reduce API drift.
- **Consequences/follow-up:** Deliberately NOT installed yet (owner decides
  the automation stack): browser-automation/computer-use tooling skills such
  as `vercel-labs/agent-browser@agent-browser`,
  `microsoft/playwright-cli@playwright-cli`, or `stablyai/orca@computer-use`.
  Revisit once the implementation approach is chosen. `DESIGN.md` extraction
  from interface.ai remains open; `extract-design-system` is ready for it.
- **References:** Project owner's request; `skills-lock.json`;
  `AGENTS.md` ## Skills; skills.sh leaderboard (2026-09-08).

### D-013 — 2026-09-08T21:00:30Z — Adopt the Vercel AI SDK with OpenRouter as the must-use LLM stack

- **Status:** accepted
- **Decision/change:** Per the project owner, all LLM access goes through the
  Vercel AI SDK (`ai` v7) with OpenRouter as the provider. Installed `ai` and
  `@openrouter/ai-sdk-provider` v3 (peer-compatible with zod v4) in
  `apps/frontend`; added `OPENROUTER_API_KEY` (names only) to
  `.env.example` as REQUIRED for AI features and a value-free placeholder to
  `.env.local`. Documented the must-use convention in `AGENTS.md`
  (`createOpenRouter()`, env-based key, no direct provider SDKs without owner
  approval). Installed the official `ai-sdk` skill (vercel/ai) and
  `openrouter-models` skill (openrouterteam/skills, official OpenRouter org)
  and listed both in `AGENTS.md` ## Skills.
- **Why:** The owner chose the AI SDK as the provider-agnostic LLM toolkit
  and OpenRouter as the single provider/gateway. The assignment's discovery
  loop is LLM-driven, so one mandated client stack avoids drift.
- **Consequences/follow-up:** No production code uses the SDK yet; the
  convention applies from the first AI feature onward. The provider reads
  `OPENROUTER_API_KEY` from the environment by default (verified in the
  installed package types). A real key must be added to `.env.local` before
  AI features run.
- **References:** Project owner's request; `apps/frontend/.env.example`;
  `AGENTS.md` #### AI SDK + ## Skills; npm `ai` 7.0.94,
  `@openrouter/ai-sdk-provider` 3.0.0; D-012.

### D-014 — 2026-09-08T21:01:38Z — Adopt assistant-ui as the must-use chat/agent UI

- **Status:** accepted
- **Decision/change:** Per the project owner, chat and agent surfaces are
  built with assistant-ui (https://www.assistant-ui.com) on top of the AI
  SDK + OpenRouter stack. Installed `@assistant-ui/react`, `@assistant-ui/
  ai-sdk`, and `@ai-sdk/react` in `apps/frontend`. Documented in `AGENTS.md`
  #### AI SDK: AI SDK v7 runtime (`useChatRuntime` client-side; route
  handlers stream with `streamText` + async `convertToModelMessages` and
  return `createUIMessageStreamResponse`), markdown-first docs (`.md` URLs),
  no custom chat UIs. Installed the five official skills from
  `assistant-ui/skills` (`assistant-ui`, `streaming`, `tools`, `primitives`,
  `runtime`) and listed them in `AGENTS.md` ## Skills.
- **Why:** The owner chose assistant-ui as the chat/agent UI layer. Its
  first-party runtime adapter for the AI SDK (v7) and its documented
  OpenRouter gateway pattern match the stack chosen in D-013, so the whole
  loop — assistant-ui components → `useChatRuntime` → Next.js route handler →
  AI SDK v7 → OpenRouter — is covered by first-party docs.
- **Consequences/follow-up:** assistant-ui components are shadcn-flavored and
  support Base UI, matching the scaffold. Its docs index lives at
  `llms.txt`; every page is fetchable as markdown via a `.md` suffix, and an
  MCP endpoint exists at https://www.assistant-ui.com/mcp. The site also
  publishes an `assistant-ui-docs` skill (skill.md); the installed GitHub
  skills from `assistant-ui/skills` are the canonical ones (6K installs).
  No UI has been built yet; convention applies from the first chat surface.
- **References:** Project owner's request; https://www.assistant-ui.com/
  llms.txt + /docs/runtimes/ai-sdk/v7.md + /docs/integrations/gateways.md;
  `AGENTS.md` #### AI SDK + ## Skills; D-013.

### D-015 — 2026-09-08T21:04:07Z — Clean up skill-folder layout; one canonical `.agents/skills/`

- **Status:** accepted
- **Decision/change:** Deleted the untracked `agent/skills/` duplicate (a
  plain copy the `npx skills add assistant-ui/skills --all` run wrote beside
  the canonical `.agents/skills/` because `--all` includes `--agent '*'`;
  the two trees held identical assistant-ui skill content with frontmatter
  normalized differently). Committed the remaining untracked assistant-ui
  skills from `.agents/skills/` (`cloud`, `copilots`, `elements`,
  `generative-ui`, `ink`, `markdown`, `observability`, `react-mcp`,
  `react-native`, `setup`, `thread-list`, `update`) — 17 total from that
  repo, all already in `skills-lock.json`. Updated `AGENTS.md` ## Skills and
  the #### AI SDK bullet to name the useful sub-skills.
- **Why:** The project owner asked whether `agent/` and `.agents/` could be
  merged. `.agents/skills/` is the canonical store the lock file tracks and
  other agents symlink from (`.claude/skills/`), so the copy goes, not the
  canonical folder.
- **Consequences/follow-up:** Convention: never use `--all` with the skills
  CLI; install with explicit `-s <names>` (adds only to `.agents/skills/` +
  the gitignored `.claude/` symlinks). If an `agent/` folder reappears after
  a skill install, delete it. The extra assistant-ui skills are documented
  as optional references, not conventions.
- **References:** Project owner's request; `skills-lock.json`; D-014.

### D-016 — 2026-09-08T21:23:02Z — Company and BankGPT research captured in context/

- **Status:** accepted
- **Decision/change:** Added [company.md](company.md) (interface.ai company
  profile: founded 2015 as Payjo, Palo Alto HQ, $30M Avataar round Oct 2024,
  100+ institutions, product portfolio) and [bankgpt/bankgpt.md](bankgpt/bankgpt.md)
  (BankGPT platform: launched 2025-11-18, one-brain agentic architecture,
  25+ core integrations, SOC 2 / ISO 27001, vendor-reported results, plus a
  section on the separate bankgpt.ai consumer hiring site). Both researched
  by background subagents against primary sources with inline citations.
- **Why:** The project owner asked for proper research on interface.ai as a
  company and on BankGPT as a product to inform design and product decisions.
- **Consequences/follow-up:** These files are reference material only; the
  deliverable stays [what-we-are-building.md](what-we-are-building.md) (see
  AGENTS.md "Scope priority"). Vendor-published claims (automation rates,
  savings) are labeled as such in the reports.
- **References:** Project owner's request; `context/company/company.md`;
  `context/bankgpt/bankgpt.md`.

### D-017 — 2026-09-08T21:23:02Z — BankGPT (bankgpt.ai) brand design system; supersedes the interface.ai brand direction

- **Status:** accepted
- **Decision/change:** Extracted the BankGPT brand from
  <https://bankgpt.ai/> into [design/DESIGN.md](design/DESIGN.md) +
  [design/tokens.json](design/tokens.json): dark-first palette (`#09090B`
  bg, emerald `#10B981` primary, violet `#8B5CF6` / indigo `#6366F1`
  accents, 105deg brand gradient), Inter + IBM Plex Mono, pill
  buttons/badges, 14–20px card radii, venn-circle logo. Token values come
  from the site's own `:root` custom properties (archived at
  design/extract-bankgpt-site.css), not eyeballing. The project owner first
  asked for the interface.ai corporate brand, then redirected to BankGPT —
  the interface.ai extraction (blue `#093EB0` / yellow `#FDCD48`, Manrope)
  was discarded; BankGPT is the product brand.
- **Why:** Project owner's redirect: "Instead of using the brand/design of
  interface.ai, we should use bankgpt's one: https://bankgpt.ai/".
- **Consequences/follow-up:** shadcn theme, fonts, logo/favicon, and OG
  image all follow the BankGPT system (D-018, D-019). If bankgpt.ai ships a
  light theme later, re-derive the light-mode tokens from it.
- **References:** Project owner's messages; https://bankgpt.ai/;
  `context/design/DESIGN.md`; `context/design/tokens.json`.

### D-018 — 2026-09-08T21:23:02Z — BankGPT shadcn theme + Inter/IBM Plex Mono fonts in apps/frontend

- **Status:** accepted
- **Decision/change:** Rewrote `apps/frontend/app/globals.css` as the BankGPT
  shadcn theme: dark mode uses the site's exact tokens (`--background` =
  `#09090B`, `--primary` = emerald-bright with deep-green `#042F23`
  foreground, white-6% borders, indigo-glow accent surface, brand chart
  ramp); light mode derives the same hues on light surfaces; `--radius`
  anchored at 1rem (brand cards are 14–20px; buttons are full pills via
  component classes). Switched `app/layout.tsx` fonts from Geist to Inter
  (`--font-sans`) + IBM Plex Mono 400/500 (`--font-mono`) via
  `next/font/google` — both are in the installed Next.js font catalog, so no
  build-time network fetch is needed.
- **Why:** Project owner asked for a precise shadcn theme matching
  DESIGN.md.
- **Consequences/follow-up:** Keep `globals.css` in sync with
  `context/design/DESIGN.md` when the brand changes (convention recorded in
  AGENTS.md "Brand"). `pnpm lint`, `typecheck`, and `build` all pass.
- **References:** Project owner's request; D-017;
  `apps/frontend/app/globals.css`; `apps/frontend/app/layout.tsx`.

### D-019 — 2026-09-08T21:23:02Z — BankGPT logo, favicon, and generated OG image

- **Status:** accepted
- **Decision/change:** Added the BankGPT logo (venn-circle mark + Inter 600
  wordmark lockup, reproduced from the site's nav component) and favicon
  (the site's own SVG + rendered 32px PNG and 180px apple-touch-icon) to
  `apps/frontend/public/` — per the project owner, only logo and favicon
  files go there. Wired `icons` + title/description metadata in
  `app/layout.tsx`. Generated a 1200×630 OG image
  (`context/design/og-image.png`) from `context/design/og-image.html` with
  headless Chromium, modeled on the site's own OG
  (`context/design/assets/bankgpt-og-reference.png`): dark bg, ambient
  indigo/emerald glows, mono eyebrow badge, gradient headline.
- **Why:** Project owner asked for the right logo/favicon and a beautiful OG
  image based on DESIGN.md, with design material saved in context/design.
- **Consequences/follow-up:** Regenerate the OG image with
  `npx playwright screenshot --viewport-size=1200,630
  context/design/og-image.html context/design/og-image.png` after brand or
  copy changes. The OG image is not yet referenced from app metadata — wire
  it when the app's public pages take shape.
- **References:** Project owner's request; D-017; `context/design/`;
  `apps/frontend/public/`.

### D-020 — 2026-09-08T21:29:38Z — BankGPT SEO layer: OG image wired, robots/sitemap/manifest, JSON-LD

- **Status:** accepted
- **Decision/change:** Wired the generated OG image into the app via the
  `app/opengraph-image.png` + `app/opengraph-image.alt.txt` file conventions
  (auto-emits `og:image`/`twitter:image` with size, type, alt). Expanded
  `app/layout.tsx` metadata: `metadataBase` (from `NEXT_PUBLIC_SITE_URL`,
  default `https://bankgpt.ai`), title template (`%s | BankGPT`), keywords,
  canonical alternates, Open Graph + Twitter cards, robots directives, and
  icon set. Added JSON-LD (`Organization` + `WebSite` + `SoftwareApplication`)
  in the layout body. Added `app/robots.ts` (allow all, disallow `/api/`),
  `app/sitemap.ts`, and `app/manifest.ts` (brand colors `#09090B`). Replaced
  the default Vercel `app/favicon.ico` with a multi-size BankGPT-mark ICO
  rendered from the brand favicon. SEO copy follows the BankGPT voice from
  `context/design/DESIGN.md`.
- **Why:** Project owner asked to wire the OG image into metadata and create
  proper SEO based on BankGPT.
- **Consequences/follow-up:** `NEXT_PUBLIC_SITE_URL` (optional, defaults to
  https://bankgpt.ai) added to `.env.example` per the env-var convention.
  Verified rendered head tags, robots.txt, sitemap.xml, and
  manifest.webmanifest on a dev server. When real pages ship, each should
  export its own `metadata` (title/description) — the `%s | BankGPT`
  template applies automatically.
- **References:** Project owner's request; D-017, D-019;
  `apps/frontend/app/layout.tsx`; `apps/frontend/app/robots.ts`;
  `apps/frontend/app/sitemap.ts`; `apps/frontend/app/manifest.ts`.

### D-021 — 2026-09-08T21:38:58Z — NEXT_PUBLIC_SITE_URL defaults to localhost in .env.local

- **Status:** accepted
- **Decision/change:** Added `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to
  `apps/frontend/.env.local` and extended the AGENTS.md ".env.local"
  convention to require it. Without it, dev fell back to the code default
  `https://bankgpt.ai`, so local canonical/OG/sitemap URLs pointed at
  production.
- **Why:** Project owner asked whether `NEXT_PUBLIC_SITE_URL` is
  automatically created for local dev per AGENTS.md — it was not; the
  convention only covered auth/OpenRouter values.
- **Consequences/follow-up:** New `.env.local` files get the localhost
  value from the start; production sets the real URL (or relies on the
  `https://bankgpt.ai` code default).
- **References:** Project owner's question; D-020; `AGENTS.md`;
  `apps/frontend/.env.local`.

### D-022 — 2026-09-08T21:42:23Z — Admin area at `/admin`; first registered user is always an admin

- **Status:** accepted
- **Decision/change:** The app gets two roles: `admin` and `operator`
  (default). The first user to register is always an admin; later signups
  are operators; admins can promote others. Management and configuration
  surfaces live under an admin-only `/admin` section (planned: users, safety
  policy, system status), guarded server-side. The day-to-day operator
  product (dashboard, discover, capabilities, runs, interventions) stays
  top-level and is available to every signed-in user.
- **Why:** Project owner direction. Some surfaces (user management, safety
  policy) are administrative and should not be reachable by every operator.
  The first-user rule removes any bootstrap or seed problem: whoever deploys
  and signs up first owns the instance.
- **Consequences/follow-up:** Supersedes the earlier discussion proposal of
  a single full-access role. Implementation mechanics (role storage,
  first-user detection, better-auth `admin` plugin vs. `additionalFields` +
  database hook, `/admin` layout guard) are to be verified against the
  installed better-auth version when built. The overall page map is still
  being finalized in discussion; this entry fixes the role rule and the
  `/admin` boundary only.
- **References:** Project owner's message; D-010 (better-auth adoption).

### D-023 — 2026-09-08T21:46:54Z — Automation engine lives in `apps/engine`

- **Status:** accepted
- **Decision/change:** The automation engine runs as its own TypeScript
  service in `apps/engine` (pnpm workspace member, ESM, strict tsc to
  `dist/`, tsx for dev, flat ESLint via typescript-eslint, Prettier matching
  repo style). Scaffolded with tooling only — no computer-use stack, LLM
  wiring, or frontend ↔ engine transport chosen yet. `esbuild` added to root
  `allowBuilds` (tsx dependency). AGENTS.md layout updated.
- **Why:** Project owner direction: the engine must not run inside the
  Next.js server. Long-running browser automation sessions and human
  handoff cannot be tied to web request lifecycles, and a separate process
  keeps the control channel (pause/cede/resume) explicit.
- **Consequences/follow-up:** Verified: root `format`, `lint`, `typecheck`,
  `build` all pass across 3 workspace projects; engine entrypoint runs
  under tsx; `dist/` gitignored. Open design questions now: the engine's
  computer-use stack (Playwright/a11y/CUA) and how the frontend and engine
  talk (shared SQLite vs. HTTP/WS control channel) — both await owner
  direction.
- **References:** Project owner's message; `apps/engine/`; D-007
  (workspace), D-022.

### D-024 — 2026-09-08T21:46:54Z — Whole authenticated app is the admin console at `/admin`

- **Status:** accepted
- **Decision/change:** All authenticated functionality — dashboard,
  discovery, capabilities, replay, runs, interventions — lives under
  `/admin` as one operator console. Inside it, management sections (users,
  safety policy, system status) additionally require the `admin` role;
  operators can use the rest. `/` redirects to `/admin` (signed in) or
  `/login` (signed out).
- **Why:** Project owner direction: everything should be viewable and
  doable from the admin panel. This is an internal operator console, not a
  consumer product, so one guarded section with role-gated sub-areas is
  simpler than splitting product vs. admin surfaces.
- **Consequences/follow-up:** Partially supersedes D-022, which had the
  operator product at top-level routes and only management under `/admin`.
  The role rule from D-022 (first registered user is admin) is unchanged.
- **References:** Project owner's message; D-022.

### D-025 — 2026-09-08T21:49:05Z — Caller-simulation chat at `/chat` via assistant-ui

- **Status:** accepted
- **Decision/change:** The app includes a caller-side chat surface at
  `/chat`, built with assistant-ui on the AI SDK v7 + OpenRouter stack,
  with streaming, tool calls, and selectable models. It simulates the
  calling AI agent (the BankGPT-style agent-facing product, out of scope
  to build for real). Its tool surface is capability invocation only:
  `list_capabilities` and `invoke_capability` (stretch goal #1), never raw
  UI actions against the target application. Rendering the system's own
  discovery transcript (a separate, read-only use of assistant-ui at
  `/admin/discover/[runId]`) remains a later decision.
- **Why:** Project owner direction. The assignment's actor #1 (the calling
  AI agent that supplies goals and invokes capabilities) must be visible in
  the demo or the "agent-invocable capability" story is only a claim in
  REPORT.md. The chat LLM decides *what*; the engine decides *how* — the
  model must never drive the target UI directly or the demo undermines
  itself.
- **Consequences/follow-up:** Until the engine persists real capabilities,
  the tools run against a clearly-labeled stub catalog. When `apps/engine`
  lands, the same tool handlers switch to real storage. `/chat` requires
  authentication.
- **References:** Project owner's messages; D-013 (AI SDK + OpenRouter),
  D-014 (assistant-ui), D-023 (engine), assignment stretch goal #1.

### D-026 — 2026-09-08T22:17:02Z — `/chat` caller simulation: assistant-ui + AI SDK v7 + OpenRouter

- **Status:** accepted
- **Decision/change:** Implemented the caller-simulation chat (D-025).
  Auth-gated via a new `(app)` route group (`/login` public, sign-in/up
  with better-auth; `/` redirects by session). Route
  `app/api/chat/route.ts` streams `streamText` over OpenRouter
  (`createOpenRouter()`), multi-step (`stepCountIs(8)`),
  `sendReasoning: true`, token-usage + model-id `messageMetadata`, and an
  AI SDK `toolApproval` gate that forces human approval for `risky`
  capabilities. Tools are a `"use generative"` toolkit compiled by
  `withAui` from `@assistant-ui/next`: `list_capabilities` and
  `invoke_capability` against a clearly-labeled stub catalog
  (`lib/capabilities-catalog.ts`, the contract the engine will honor),
  each with a BankGPT-styled render; invocation UI covers approval /
  denied / running / success / business-outcome / hard-failure. Model
  picker (`model-selector` element) offers six verified tool+reasoning
  models; the route validates the client-sent `config.modelName` against
  `lib/chat-models.ts` and applies `config.reasoningEffort` via
  `extraBody`. Client: `useChatRuntime` with
  `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`,
  suggestions, branded welcome, token-usage pill.
- **Why:** Owner direction (D-025). Every API was verified against the
  installed packages' docs/types (ai 7.0.94, @assistant-ui/react 0.15.18,
  @assistant-ui/ai-sdk 0.0.4, @openrouter/ai-sdk-provider 3.0.0).
- **Consequences/follow-up:** Server-verified over SSE: streaming text,
  list_capabilities call+result, approval-request emission for a risky
  capability, business-outcome path. Fixed two real bugs found in
  verification: toolkit renders must tolerate null/partial streaming args
  (args are null until input streams in), and the invoke render needs
  `display: "standalone"` so gates never collapse into the tool group.
  The playwright clickthrough raced the assistant-ui composer (Enter is a
  newline while a run streams) — flaky as a script, abandoned per owner;
  manual test steps handed to the owner instead. `playwright` added as a
  devDependency for ad-hoc screenshots. `components/assistant-ui/elements/`
  are owned copies: fixed the generated `useShallowStable` ref-in-render
  (rewrote with the set-state-during-render pattern) and aliased the local
  `Image` element vs `next/image` with justified `<img>` lint suppressions.
- **References:** `apps/frontend/app/(app)/chat/`, `app/api/chat/route.ts`,
  `lib/capabilities-catalog.ts`, `lib/chat-models.ts`; D-013, D-014, D-025;
  assistant-ui skills (setup/tools/elements).
