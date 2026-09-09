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

### D-027 — 2026-09-08T22:32:29Z — `/admin` operator console + first-user-admin roles

- **Status:** accepted
- **Decision/change:** Built the `/admin` operator console (D-024) and the
  role system (D-022). Roles: `admin` | `operator` as a nullable
  `user.additionalFields.role` (nullable so pre-existing rows migrate; hook
  always sets it for new users). First-user rule: a better-auth
  `databaseHooks.user.create.before` hook assigns `admin` when the user
  table is empty. better-auth `admin` plugin (custom access controller with
  roles named `admin`/`operator`, default `operator`, adminRoles
  `["admin"]`) provides server-enforced `/admin/list-users` +
  `/admin/set-role`. Routes: `/admin` overview (greeting, capability stats
  from the stub catalog, quick actions, role-aware), `/admin/discover` +
  `/admin/capabilities` + `/admin/runs` + `/admin/interventions` as
  `PageStub` placeholders that document what lands with the engine, and
  admin-only `/admin/users` (role management table), `/admin/policy`
  (read-only safety policy), `/admin/system` (env-key + DB status, never
  values). Admin-only routes share a server-side `AdminOnlyLayout` guard
  (redirect to `/admin`); the whole console sits behind the `(app)` auth
  guard. Shared `AdminShell` sidebar hides Manage links for non-admins and
  shows the signed-in email + role. `/` now redirects to `/admin`; login
  and the chat header link there too.
- **Why:** Owner direction (D-024, D-022). The console is where operators
  and reviewers work; management surfaces need a real admin gate.
- **Consequences/follow-up:** Migration re-run added `role` + admin-plugin
  columns (nullable, so the two pre-existing rows migrated cleanly; the
  owner backfilled to admin by oldest-first then corrected manually). The
  better-auth CLI's migrate needs `defaultRole`/`adminRoles` set or it
  fails on NOT NULL role with a NULL default. `listUsers`/`setRole` are
  admin-plugin endpoints — server-enforced, not just UI-hidden. Verified by
  the owner manually. The four engine-dependent surfaces are honest stubs;
  their planned content is listed on each page.
- **References:** `apps/frontend/app/(app)/admin/`, `lib/auth.ts`,
  `lib/auth-client.ts`, `lib/roles.ts`; D-010, D-022, D-024, D-026.

## D-028 — 2026-09-08T22:33:49Z — Tailwind named font sizes, no arbitrary `text-[Npx]`

- **Status:** accepted
- **Decision/change:** Replaced all 20 `text-[10px]` arbitrary classes with
  `text-xs` across the frontend (10 files: chat client/toolkit, admin shell,
  admin pages, users table, login form, page stub). Recorded the convention
  in `AGENTS.md` under Code style: use Tailwind's named font-size scale
  instead of arbitrary pixel sizes.
- **Why:** Owner direction — arbitrary one-off sizes drift from the design
  scale; named steps keep typography consistent and greppable.
- **Consequences/follow-up:** Slight visual change: `text-xs` is 12px with
  its own line-height vs the old fixed 10px. Accepted by the owner.
- **References:** `AGENTS.md` (Code style), `apps/frontend/app/(app)/`,
  `apps/frontend/app/login/`, `apps/frontend/components/admin/`.

## D-029 — 2026-09-08T22:34:26Z — Admin console content is full width

- **Status:** accepted
- **Decision/change:** Removed the `max-w-4xl`/`max-w-3xl`/`max-w-2xl`
  constraints from all `/admin` content wrappers (overview, policy, users,
  system, and the `PageStub` used by discover/capabilities/runs/
  interventions) so content spans the full shell width. Recorded the
  convention in `AGENTS.md` under Code style.
- **Why:** Owner direction — constrained columns waste the console's
  horizontal space.
- **Consequences/follow-up:** Future admin surfaces stay full width; size
  inner elements individually when a measure is needed.
- **References:** `AGENTS.md` (Code style), `apps/frontend/app/(app)/admin/`,
  `apps/frontend/components/admin/page-stub.tsx`.

## D-030 — 2026-09-08T22:44:10Z — Persistent chat threads, composer model selector, dictation

- **Status:** accepted
- **Decision/change:** The caller chat is now multi-threaded with SQLite
  persistence. New `chat_thread` + `chat_message` tables (per user) with
  `/api/threads` CRUD, message history load/upsert/delete, and title
  generation (DeepSeek V3.2 low effort via OpenRouter, streamed through
  assistant-stream). The client uses `useRemoteThreadListRuntime` with
  `useChatRuntime` as the nested per-thread hook, a module-stable
  `RemoteThreadListAdapter` in `lib/thread-list-adapter.ts` (history via
  `withFormat` so the AI SDK storage format keeps reasoning + tool parts),
  and the registry `thread-list` element in a new sidebar with the Console
  link pinned bottom-left. Messages persist as encoded UIMessages, so
  reasoning blocks survive reload (fixes the reasoning-loss report). The
  model selector moved from the header into the composer next to the
  attachment button, with single-path provider icons (svgl/simple-icons) and
  the model/effort choice persisted to localStorage. Voice input uses
  `WebSpeechDictationAdapter` (Chrome/Safari; mic button hides when
  unsupported). Also extracted the shared SQLite handle into `lib/db.ts`
  with WAL + busy_timeout (fixes "database is locked" between dev server and
  build).
- **Why:** Owner direction — threads, reasoning persistence, composer model
  selector like assistant-ui.com, bottom-left console link, easy voice.
- **Consequences/follow-up:** Threads are per user, scoped by session on
  every route. Title generation costs one cheap LLM call per thread. No
  realtime OpenRouter voice yet — dictation transcribes into the composer;
  realtime speech-to-speech is a separate decision. Existing single-thread
  chats are not migrated (there was no persistence before).
- **References:** `apps/frontend/lib/chat-threads.ts`,
  `apps/frontend/lib/thread-list-adapter.ts`,
  `apps/frontend/app/api/threads/`,
  `apps/frontend/app/(app)/chat/chat-client.tsx`,
  `apps/frontend/components/assistant-ui/elements/thread-list.aui.tsx`,
  `apps/frontend/components/assistant-ui/elements/model-icons.tsx`,
  `apps/frontend/lib/db.ts`.

## D-031 — 2026-09-08T22:44:10Z — Owner tests manually; no automated E2E by default

- **Status:** accepted
- **Decision/change:** Recorded in AGENTS.md (Definition of done): do not
  write or run automated browser/E2E tests (Playwright etc.) for UI changes
  unless asked; ship, keep the dev server available, and let the owner
  verify.
- **Why:** Owner direction — per-change automated E2E is unwanted overhead.
- **Consequences/follow-up:** Definition of done stays format + lint +
  typecheck + build.
- **References:** `AGENTS.md` (Definition of done).

## D-032 — 2026-09-08T22:47:17Z — Hydration-safe client-only values; pointer cursors

- **Status:** accepted
- **Decision/change:** Fixed model/effort not sticking across refresh: the
  previous `useSyncExternalStore` read returned a different server vs client
  snapshot (localStorage), a hydration mismatch that poisoned client state
  for the session. Client-only values now use one of two patterns, per the
  existing react-hooks lint rules (no `setState` in effects): lazy one-time
  `useState` initializers gated by `typeof window` for control state
  (model/effort), and a shared `hooks/use-mounted.ts`
  (`useSyncExternalStore` with identical SSR + first-client snapshots) for
  mount detection. The selector and the mic button stay mounted but
  CSS-`invisible` until hydrated, so SSR and the first client render agree.
  Also added `cursor-pointer` to the composer send/cancel/dictate buttons,
  the New Thread button, thread list item triggers, and the model-selector
  trigger, and made the selector always-controlled (effort defaults to
  "low" so it always shows).
- **Why:** Owner reports — effort lost on refresh; pointer cursors missing.
- **Consequences/follow-up:** Rule of thumb for this codebase: never read
  `window`/`localStorage` during SSR or the first client render except
  through these two gates; a server/client snapshot mismatch is silent and
  breaks hydration.
- **References:** `apps/frontend/hooks/use-mounted.ts`,
  `apps/frontend/app/(app)/chat/chat-client.tsx`,
  `apps/frontend/components/assistant-ui/elements/thread.aui.tsx`.

## D-033 — 2026-09-08T22:51:54Z — Dark theme is forced; no system preference

- **Status:** accepted
- **Decision/change:** The app is dark-only. `ThemeProvider` now sets
  `defaultTheme="dark"` + `forcedTheme="dark"` with `enableSystem` removed,
  and the `d` dark/light hotkey was deleted. AGENTS.md brand + stack notes
  updated. Also in this change: `cursor-pointer` on command dropdown items
  (model list), replacing the shadcn `cursor-default`.
- **Why:** Owner direction — the brand is dark-native; a light mode is not
  offered and system preference must never light-render the app.
- **Consequences/follow-up:** Any stale `theme` localStorage value is
  overridden by `forcedTheme`. Design work only needs dark tokens.
- **References:** `apps/frontend/components/theme-provider.tsx`,
  `AGENTS.md`, `apps/frontend/components/ui/command.tsx`.

## D-034 — 2026-09-08T23:03:21Z — Mount-gate the selector; no server/client value branches

- **Status:** accepted (supersedes part of D-032)
- **Decision/change:** Fixed the lingering hydration error on `/chat`.
  D-032's `useState(typeof window !== "undefined" ? readStored : default)`
  lazy initializer is itself a server/client render branch — SSR rendered
  the default model (Claude) while the client's first render used the
  stored one (Gemini), so React flagged a mismatch. The model selector now
  renders a fixed-size placeholder during SSR and the first client render
  (identical markup) and swaps in the real selector only after mount, so
  `localStorage` is read solely on the post-hydration pass. Verified with a
  production SSR render (seeded storage) — no hydration error.
- **Why:** Owner reported the hydration error.
- **Consequences/follow-up:** Hard rule for this codebase: never branch a
  render on `typeof window`/`localStorage` between SSR and first client
  render — not even in a `useState` initializer. Client-only values go
  behind the `useMounted` gate (placeholder or CSS-invisible wrapper) and
  are read only after mount.
- **References:** `apps/frontend/app/(app)/chat/chat-client.tsx`,
  `apps/frontend/hooks/use-mounted.ts`.

## D-035 — 2026-09-08T23:06:08Z — GPT-OSS 120B added as the default chat model

- **Status:** accepted
- **Decision/change:** Added `openai/gpt-oss-120b` ("GPT-OSS 120B") to the
  chat model catalog as the first entry, which makes it the default for new
  chats and the server-side fallback
  (`DEFAULT_CHAT_MODEL_ID = CHAT_MODELS[0].id`). Claude Sonnet 4.6's
  "balanced default" description was reworded since it is no longer the
  default. The picker logo needed no new asset: the selector maps the
  `openai` provider slug to the existing `OpenAIIcon`, and gpt-oss has no
  distinct brand mark — OpenAI uses the standard OpenAI logo for it.
- **Why:** Owner request — offer OpenAI's open-weight 120B model, make it
  the default, and show its logo.
- **Consequences/follow-up:** Verified against the live OpenRouter catalog
  on 2026-09-08: `openai/gpt-oss-120b` supports `tools`, `reasoning`, and
  `reasoning_effort`. Existing users keep their localStorage-stored model;
  the new default applies only when no valid stored choice exists.
- **References:** `apps/frontend/lib/chat-models.ts`,
  `apps/frontend/app/(app)/chat/chat-client.tsx` (`PROVIDER_ICONS`),
  `apps/frontend/components/assistant-ui/elements/model-icons.tsx`.

## D-036 — 2026-09-08T23:12:36Z — Chat catalog rebuilt for speed + tool calling; `:nitro` routing everywhere

- **Status:** accepted
- **Decision/change:** Rebuilt the chat model catalog per owner direction:
  removed Claude Opus 4.8, GPT-5.4, Gemini 3.1 Pro, Grok 4.6, and DeepSeek
  V3.2; added Claude Haiku 4.5, GPT-OSS 20B, GLM 5.3 Flash, and DeepSeek V4
  Flash (dated stable id `deepseek/deepseek-v4-flash`, canonical
  `…-20260423` — chosen over the `~…-latest` moving alias and the
  `vision-exp` variant). GPT-OSS 120B stays the default. Every catalog id now
  carries the `:nitro` variant, OpenRouter's throughput-sort routing shortcut
  (equivalent to `provider.sort: "throughput"`), so requests always land on
  the fastest live provider. Added a `ZAIIcon` (lobe-icons single-path mark,
  currentColor) and mapped the `z-ai` provider slug in the selector.
- **Why:** Owner wants high TPS and reliable tool calling. Verified against
  the live OpenRouter catalog and endpoints APIs on 2026-09-08: all six
  entries support `tools` + `reasoning`; gpt-oss-120b nitro routes to
  Cerebras (~760 tok/s p50), gpt-oss-20b to Groq (~442 tok/s), GLM 5.3 Flash
  has tools on 24/24 providers and tops public function-calling boards.
- **Consequences/follow-up:** `:nitro` trades price for speed — e.g.
  gpt-oss-120b's fastest provider costs ~$0.15/M in vs ~$0.037/M cheapest.
  The picker displays model names only; the suffix is invisible in the UI.
  gpt-oss-20b has tools on only 8/13 providers, but nitro routing plus
  OpenRouter's `require_parameters` default keeps tool requests on capable
  endpoints. Existing users keep localStorage-stored (old, now invalid)
  model ids until they reselect — `readStoredModel` falls back to the new
  default when the stored id is no longer in the catalog.
- **References:** `apps/frontend/lib/chat-models.ts`,
  `apps/frontend/app/(app)/chat/chat-client.tsx`,
  `apps/frontend/components/assistant-ui/elements/model-icons.tsx`,
  <https://openrouter.ai/announcements/introducing-nitro-and-floor-price-shortcuts>.


## D-037 — 2026-09-08T23:21:24Z — Persist generated thread titles (title was lost on refresh)

- **Status:** accepted
- **Decision/change:** `POST /api/threads/[threadId]/title` now persists the
  generated title with `renameThread` before streaming it back. Root cause:
  assistant-ui's `RemoteThreadListThreadListRuntimeCore.generateTitle`
  applies the streamed title as optimistic local state only — its `execute`
  callback is a no-op and it never calls `adapter.rename` — so persistence is
  the endpoint's job, and the route never wrote to SQLite. Symptom: a
  generated title appeared in the sidebar until refresh, then reverted to
  "New Chat" (the ThreadList fallback for a null title). Also hardened the
  title string: empty model output falls back to "New Chat" and the value is
  clamped to 200 chars to match the PATCH schema.
- **Why:** Owner-reported bug — new threads always show "New Chat" after a
  refresh even though a summary title briefly appears.
- **Consequences/follow-up:** Threads that already have a null title stay
  untitled. If title generation fails server-side, the thread keeps its
  previous title and the client logs the error (unchanged behavior).
- **References:** `apps/frontend/app/api/threads/[threadId]/title/route.ts`,
  `apps/frontend/lib/chat-threads.ts`,
  `@assistant-ui/core/dist/react/runtimes/RemoteThreadListThreadListRuntimeCore.js`
  (`generateTitle`, ~lines 534–570).

## D-038 — 2026-09-08T23:21:32Z — No automated verification of changes; owner tests everything manually

- **Status:** accepted
- **Decision/change:** Broadened the AGENTS.md "Definition of done" testing
  rule from D-031: the ban now covers all automated verification of changes,
  not just browser/E2E tests for UI changes — no Playwright/Cypress suites
  and no scripted end-to-end click-throughs against the dev server
  (curl/API scripts that simulate a user session) unless the owner asks.
  The pre-commit gate stays format + lint + typecheck + build.
- **Why:** Owner correction — per-change scripted verification is unwanted
  overhead and has proven flaky (the Playwright composer race in D-026, and
  an aborted scripted API-level verification of the title route while
  landing D-037). The owner tests everything manually for now.
- **Consequences/follow-up:** Supersedes D-031 with a broader rule. The
  `playwright` devDependency stays for ad-hoc screenshots only (D-026), not
  for test suites.
- **References:** `AGENTS.md` (Definition of done); D-031, D-026.

## D-039 — 2026-09-08T23:32:49Z — Sidebar brand blocks show the BankGPT logo lockup only

- **Status:** accepted
- **Decision/change:** The top-left brand block in the `/chat` sidebar now
  shows the `bankgpt-mark.svg` logo with a single "BankGPT" wordmark —
  the "Caller" suffix and the "Capability invocation only" subtitle are
  gone. The `/admin` console sidebar likewise drops its "Admin console"
  eyebrow, keeping logo + "BankGPT".
- **Why:** Owner direction — the top left on both surfaces should be just
  BankGPT with the logo, not the surrounding labels.
- **Consequences/follow-up:** The `/chat` main-panel header and welcome
  screen still carry "Caller simulation" eyebrows; the owner was told and
  left them in place. Page metadata (e.g. `title: "Caller Chat"`) is
  unchanged.
- **References:** `apps/frontend/app/(app)/chat/chat-client.tsx`,
  `apps/frontend/app/(app)/admin/admin-shell.tsx`.

## D-040 — 2026-09-08T23:32:58Z — Fix bankgpt-mark.svg aspect-ratio warning (Next.js Image)

- **Status:** accepted
- **Decision/change:** The `<Image>` props for `/bankgpt-mark.svg` now match
  the mark's intrinsic 100×60 (5:3) viewBox instead of forcing square
  boxes: chat sidebar 24×24 → 40×24, admin sidebar 26×26 → 45×27, login
  page 44×44 → 70×42. Root cause of the browser warning "Image with src
  /bankgpt-mark.svg has either width or height modified, but not the
  other": next/image detected a CSS-vs-attribute ratio mismatch because the
  square props distorted the 5:3 SVG.
- **Why:** Owner-reported console warning; the logo also rendered squashed.
- **Consequences/follow-up:** The mark renders undistorted at roughly the
  same visual height; the chat-sidebar lockup is wider than before
  (24px → 40px box). If the SVG's viewBox ever changes, the props must
  change with it.
- **References:** `apps/frontend/app/(app)/chat/chat-client.tsx`,
  `apps/frontend/app/(app)/admin/admin-shell.tsx`,
  `apps/frontend/app/login/login-form.tsx`,
  `apps/frontend/public/bankgpt-mark.svg`.

## D-041 — 2026-09-08T23:33:08Z — Gate dictation on browser support and surface failures in the composer

- **Status:** accepted
- **Decision/change:** New `lib/dictation.ts` owns dictation setup.
  `createDictationAdapter()` returns `undefined` when
  `WebSpeechDictationAdapter.isSupported()` is false, so the runtime's
  dictation capability — and thus the composer mic button — stays off in
  browsers where clicking it could never work.
  `ReportingDictationAdapter` wraps the Web Speech adapter and forwards
  recognition failures to a new `DictationErrorBanner` in the composer
  (dismissible, auto-hides after 6s) with per-code messages (`network`,
  `not-allowed`, `audio-capture`, `no-speech`, ...). Root cause of the
  owner-reported `Dictation error: "network" ""`: Chrome's
  `SpeechRecognition` proxies audio to Google's servers and raises
  `network` when that service is unreachable — environmental, not an app
  bug; previously it surfaced only as a `console.error`.
- **Why:** Owner clicked the mic and got nothing but a console error; the
  failure was invisible in the UI and the button appeared even in
  unsupported browsers.
- **Consequences/follow-up:** `console.error` is wrapped for the duration
  of `adapter.listen()` to recover the error code the library only logs;
  all other `console.error` calls pass through untouched. Actually making
  dictation work needs a browser whose speech service is reachable (real
  Chrome/Edge/Safari, online); a self-hosted adapter (e.g. local Whisper)
  would be a follow-up if offline dictation is wanted.
- **References:** `apps/frontend/lib/dictation.ts`,
  `apps/frontend/app/(app)/chat/chat-client.tsx`,
  `apps/frontend/components/assistant-ui/elements/thread.aui.tsx`,
  `@assistant-ui/core/dist/adapters/speech.js`.

### D-039 — 2026-09-08T23:34:31Z — Computer-use stack: Playwright + accessibility-tree snapshots (proposal)

- **Status:** proposed (owner confirmation requested; proceeding per the
  goal's proceed-if-unanswered rule)
- **Decision/change:** The engine's computer-use stack is **Playwright driving
  Chromium**, observed through **accessibility-tree snapshots** (role, name,
  state) plus screenshots for the model's situational awareness. Discovery
  uses a vision-capable model via OpenRouter (D-013 stack: `ai` +
  `@openrouter/ai-sdk-provider` in `apps/engine`). The saved capability
  artifact binds each step to **a11y role/name locators** (Playwright
  `getByRole`-style), with CSS/text fallbacks recorded for robustness —
  never raw coordinates.
- **Why:** DOM/a11y targeting is what makes replay deterministic and cheap;
  pixel-coordinate CUA replay breaks on any layout shift. The assignment
  explicitly blesses accessibility trees. Screenshots guide the LLM during
  discovery, but the artifact replays against semantic locators, which
  survive styling, branding, and minor drift — exactly the multi-tenant
  property REPORT.md must argue. One model call per discovery step; zero
  model calls on replay.
- **Consequences/follow-up:** `playwright` becomes an `apps/engine`
  dependency (already a frontend devDependency for screenshots, D-026).
  The exact discovery model is chosen at implementation time from the
  OpenRouter catalog (needs vision + tools); record it when pinned.
- **References:** assignment §4 (computer-use technology is our call);
  D-013, D-023.

### D-040 — 2026-09-08T23:34:31Z — Proxy target: local mock bank "FinCore Teller" (proposal)

- **Status:** proposed (owner confirmation requested; proceeding per the
  goal's proceed-if-unanswered rule)
- **Decision/change:** The proxy target is a **small local mock bank app we
  build** at `apps/mockbank` (pnpm workspace member, zero runtime
  dependencies — Node `http` + static HTML/vanilla JS, no framework). It
  implements the workflows already named in the stub catalog
  (`lib/capabilities-catalog.ts`): member search → member detail → balances;
  open sub-account with a confirmation screen; freeze debit card. It
  deliberately includes the hostile properties replay must survive:
  table-based layouts, no test IDs, a real confirmation dialog, a session
  timeout, and a "member not found" path.
- **Why:** The brief's ground rules forbid real credentials/PII and risky
  automation against third-party sites; a local target has zero
  terms/rate-limit exposure, fully reproducible data for `/evidence/`, and
  we control the write actions (opening an account) that no public banking
  demo safely offers. We can also inject the exact exceptional states the
  error taxonomy must handle.
- **Consequences/follow-up:** `apps/mockbank` is demo infrastructure, not
  the product; REPORT.md's Cuts section notes that real targets are legacy
  third-party apps. The stub catalog's `targetApp: "FinCore Teller
  (proxy)"` becomes literally true.
- **References:** assignment §4 (target application is our call; local
  sample app explicitly allowed); `apps/frontend/lib/capabilities-catalog.ts`.

### D-041 — 2026-09-08T23:34:31Z — Frontend ↔ engine transport: HTTP + WebSocket control channel (proposal)

- **Status:** proposed (owner confirmation requested; proceeding per the
  goal's proceed-if-unanswered rule)
- **Decision/change:** The engine exposes an **HTTP API** (runs, artifacts,
  evidence, policy) plus a **WebSocket control channel** for live-session
  traffic (step stream, pause/cede/resume, operator input during handoff).
  The Next.js frontend calls the engine server-side (route handlers /
  server components proxying with the engine URL from env). Engine state
  (runs, artifacts, interventions) persists in the engine's own SQLite
  database, separate from the auth DB.
- **Why:** The assignment's handoff requires live, bidirectional
  pause/cede/resume against the *same* running session — shared-SQLite
  polling can't do that cleanly (D-023's open question). An explicit
  control channel keeps ownership unambiguous and matches the "clean seam"
  the assignment rewards.
- **Consequences/follow-up:** New env var `ENGINE_URL` (name only) goes in
  `apps/frontend/.env.example`; the engine gets its own port + env example.
  Auth between frontend and engine is local-dev-simple (shared token) and
  documented as a cut for production.
- **References:** D-023 (transport was the open question); assignment §3.5
  (escalation), §4 (architecture is our call).

### D-042 — 2026-09-08T23:49:32Z — Mock bank "FinCore Teller" built at apps/mockbank

- **Status:** accepted (implements D-040)
- **Decision/change:** Built the proxy target at `apps/mockbank`: zero-dep
  Node `node:http` server-rendered teller console (port 4010, localhost),
  implementing the three stub-catalog workflows — member search → detail →
  balances; open sub-account (form → review with a native `window.confirm`
  + checkbox → confirmation with `?c=CNF-####`); freeze card (reason select
  → Frozen). 7 deterministic seed members; `POST /__reset__` reseeds and
  clears sessions. Deliberate hostility per D-040: nested-table layouts, no
  ids/data-*/test-ids (real `<button>/<a>/<input>/<select>/<label>` so a11y
  locators work), 50–400 ms latency (1–2 s search), a per-session
  every-7th-GET transient 500, and 5-minute inactivity session expiry.
- **Why:** Gives the engine a safe, reproducible target that exercises the
  exact exceptional states the replay error taxonomy must handle, with no
  terms/PII exposure.
- **Consequences/follow-up:** Scripts are only `dev`/`start` — deliberate
  demo infrastructure (a documented cut for REPORT.md). Full decision list
  in `apps/mockbank/NOTES.md`.
- **References:** `apps/mockbank/README.md`, `apps/mockbank/NOTES.md`; D-040.

### D-043 — 2026-09-08T23:49:32Z — Engine core: discovery loop, artifact schema, deterministic replay

- **Status:** accepted (implements D-039; D-041 partial — HTTP+WS server built)
- **Decision/change:** Built `apps/engine`: (1) genuine observe → decide →
  act discovery loop — Playwright `page.ariaSnapshot()` + screenshot → one
  structured model call per step (AI SDK v7 `generateText` + `Output.object`,
  zod action schema) → Playwright `getByRole` — with goal-met / stuck /
  max-steps / timeout stops, then a distillation call that emits the
  artifact; (2) the capability artifact schema (`src/artifact.ts`, zod v4,
  `z.infer` types): strategy-tagged locators (a11y role+name primary, css/
  text fallbacks, robustness note), typed inputs/outputs, ordered steps,
  machine-checkable checkpoint, `businessOutcomes` detect table; (3)
  deterministic replay with zero model calls, locator fallback order,
  `{{input}}` substitution, output extraction, business-outcome +
  checkpoint verification, result taxonomy success | business_outcome |
  recoverable | hard_failure (`src/results.ts`); (4) policy — URL + action
  allowlists enforced in discovery and replay, approval-token seam for
  risky actions, redaction of secret/PII-shaped values; (5) evidence —
  per-step JSONL, failure screenshot + aria snapshot, full transcript, all
  redacted; (6) SQLite storage (better-sqlite3, WAL); (7) HTTP API + WS
  control channel with a session registry + control state machine
  (`src/session.ts`); (8) CLI `discover` / `replay` (README demo path).
  Discovery model: `google/gemini-2.5-flash` via OpenRouter (vision +
  structured output).
- **Why:** This is the graded core of the assignment — a real LLM-driven
  run distilled into a typed, reviewable artifact that replays with no
  model in the loop.
- **Consequences/follow-up:** Verified genuine runs recorded in
  `apps/engine/evidence/` (fixture discovery + artifact, happy-path replay,
  member-not-found business outcome); graded runs against finished mockbank
  happen at integration. Open issues deferred to the console phase:
  approval tokens not yet scoped per run; discovery runs not yet on
  LiveSession / WS-streamed; engine DB path should be set explicitly by the
  frontend (`ENGINE_DB_PATH`/`ENGINE_EVIDENCE_DIR`); `ENGINE_URL` env name
  owed to `apps/frontend/.env.example`.
- **References:** `apps/engine/README.md`, `apps/engine/NOTES.md`; D-039,
  D-041, D-023.

### D-044 — 2026-09-09T00:01:45Z — Typed engine client + /api/engine proxy layer in the frontend

- **Status:** accepted (implements D-041 frontend half)
- **Decision/change:** Built `apps/frontend/lib/engine/`: zod mirrors of the
  engine contract (artifact, result taxonomy, run/intervention rows,
  request/response) with `z.infer` types; a server-only client (`client.ts`)
  reading `ENGINE_URL` (default `http://127.0.0.1:4011`); thin auth-gated
  proxy route handlers under `app/api/engine/` (capabilities, runs +
  evidence, discover, replay, approvals approve/reject, status); and
  `@tanstack/react-query` query keys + fetchers + mutations (`queries.ts`).
  Offline degradation is explicit: proxy answers 503 with a "pnpm --filter
  engine dev" hint, client fetchers raise `EngineOfflineError`, and the
  `/admin` overview falls back to the stub catalog with an amber banner
  (live stats — deduped capabilities, risky count, pending interventions —
  when reachable). `ENGINE_URL` added (OPTIONAL) to
  `apps/frontend/.env.example`.
- **Why:** The admin console and chat need one typed, degradable seam to the
  engine; per D-023 the engine is a separate process, so the frontend reaches
  it server-side over HTTP.
- **Consequences/follow-up:** No `QueryClientProvider` exists yet — the
  Phase-3 page worker mounts one. WebSocket `/ws` (run-step stream,
  pause/cede/resume) is NOT proxied (Next route handlers can't upgrade WS) —
  the live-session UI needs a separate transport answer. `POST /capabilities`
  intentionally not proxied. Chat stub catalog and the four PageStub surfaces
  remain for later workers.
- **References:** `apps/frontend/lib/engine/NOTES.md`, D-041, D-043.

## D-045 — 2026-09-09T00:10:23Z — Graded evidence runs + engine hardening at integration

- **Status:** accepted
- **Decision/change:** Ran the final, graded discovery + replay evidence for
  both capabilities against the finished mockbank and hardened the engine
  where the real runs exposed gaps: (1) native-dialog handling
  (`src/dialogs.ts`, policy `dialogHandling`, logged `dialog` steps) in
  discovery AND replay; (2) transient-5xx recovery in replay (reload the
  idempotent page and re-drive the step, bounded and logged as
  `transient-reload`); (3) distillation grounded in the terminal page's
  visible text + live-probed business-outcome rules, with distill failures
  logged instead of swallowed; (4) whitespace-normalized, last-capture-group
  page-text extraction; (5) business outcomes win over failed-step
  checkpoints, with per-step `suppressOutcomes` and a fast pre-checkpoint
  probe; (6) re-fill suppression for already-typed inputs on re-rendered
  pages; (7) enforcement of `requireReviewForRisky` for unreviewed risky
  capabilities; (8) optional inputs substitute empty when omitted. Both
  artifacts (`get_member_balances`, `open_sub_account`) carry a documented
  human review pass and `reviewed: true`. The graded bundle lives at the
  repo-root **`/evidence/`** (assignment's exact deliverable path) with a
  README index; run notes appended to `apps/engine/NOTES.md`.
- **Why:** The assignment's core rule is a GENUINE discovery run with
  evidence in `/evidence/`; integration against the finished mockbank
  surfaced the exact hostile properties (native confirm, transient 500,
  validation re-renders, session expiry) the engine had to survive, and the
  fixes above are what made every graded path green.
- **Consequences/follow-up:** Discovery-loop 5xx recovery still relies on
  the model's own retry choice (replay has a structured one); approval
  tokens remain unscoped per run server-side. Both recorded as REPORT cuts.
- **References:** `/evidence/README.md`, `apps/engine/NOTES.md`; D-039,
  D-042, D-043.

### D-046 — 2026-09-09T00:17:08Z — Admin console surfaces live on the engine data layer

- **Status:** accepted (implements D-024; consumes D-044)
- **Decision/change:** Replaced the four PageStub surfaces with live,
  engine-backed pages. Mounted a `QueryClientProvider`
  (`components/admin/engine-providers.tsx`) in the admin layout; shared
  query states/pills/formatters in `components/admin/engine-ui.tsx`.
  `/admin/capabilities` — deduped list + `/admin/capabilities/[id]` detail
  (ordered steps with primary locator + fallbacks + robustness, typed
  inputs/outputs, checkpoint, businessOutcomes, Mark-reviewed, and a
  zod-validated `@tanstack/react-form` Replay form). `/admin/runs` — live
  run history (polls while running) + `/admin/runs/[id]` detail (structured
  result per status, step evidence). `/admin/discover` — zod-validated
  start-discovery form embedding the new run's live progress. All pages
  render loading skeletons, an amber engine-offline banner, and empty
  states. `/admin/interventions` and the chat stub left for the
  live-session worker.
- **Why:** The console is where operators and reviewers work (D-024); these
  pages make the engine's capabilities, runs, and evidence inspectable.
- **Consequences/follow-up:** Known gaps for later: capability list rows
  carry no artifact (enriched per card via `useQueries`); no
  evidence-binary endpoint (failure screenshots shown as a path hint — add
  a GET evidence-file route if the demo needs them); runs list unsorted
  (sorted client-side). Evidence streaming reuses run-row polling +
  evidence refetch (interim until the WS live-session UI lands).
- **References:** `apps/frontend/app/(app)/admin/`,
  `apps/frontend/lib/engine/NOTES.md`; D-024, D-044, D-045.

### D-047 — 2026-09-09T09:43:30Z — Approval segregation + live-session handoff (recovered after worker interruption)

- **Status:** accepted (Phase 2 + assignment §3.5). Recovered from an
  interrupted worker: feature code was committed (commits be5fb31, 7b2a9fd,
  9131012, 19f18ae); this ledger entry and the proof-run evidence were
  still pending.
- **Decision/change:** (1) **Approval segregation** — a risky capability
  invoked in `/chat` now raises an identity-carrying approval/intervention
  decided by a *different* authenticated operator in `/admin/interventions`
  instead of the requesting user self-approving; approval tokens are scoped
  per capability/run; approver identity + timestamp + reason are persisted
  as evidence. Safe capabilities still replay straight through; the stub
  catalog remains only as an offline+safe fallback. (2) **Live-session
  handoff** — runs execute on registered `LiveSession`s; stuck detection
  raises an intervention carrying goal/capability, step, state, and reason;
  `/admin/interventions` provides a take-over panel (live state via
  `GET /api/engine/sessions/[runId]/state`, actions via
  `.../action`) with pause/cede/resume over the WebSocket control channel;
  human actions are recorded; control ownership is explicit. (3) **WS
  transport** — because Next.js route handlers cannot proxy WebSocket
  upgrades, the browser connects directly to the engine's `/ws` via
  `NEXT_PUBLIC_ENGINE_WS_URL` (name-only in `.env.example`), resolving the
  D-044 open note. New proxy routes: `/api/engine/sessions/[runId]/state`
  and `/action`.
- **Why:** Regulated back-office actions need maker-checker (the requester
  must never approve their own consequential action), and the assignment
  requires a real pause → operator-take-over → resume against the same live
  session.
- **Consequences/follow-up:** The genuine approval + stuck-take-over proof
  runs (the worker's temp evidence drivers were lost on interruption) are
  re-captured by the refactor worker and land under `/evidence/runs/`;
  engine NOTES gap list updated accordingly.
- **References:** `apps/engine/src/session.ts`, `src/server.ts`,
  `apps/frontend/app/(app)/admin/interventions/`,
  `apps/frontend/lib/engine/ws.ts`; assignment §3.5; D-044, D-045.

### D-048 — 2026-09-09T10:00:54Z — Engine server migrated to Hono; `@/` import alias; handoff proof evidence

- **Status:** accepted (owner direction)
- **Decision/change:** Two owner-requested refactors, both
  behavior-preserving (verified: CLI replay success, POST /replay 202 + WS
  step stream, 12 route status/message probes matching old behavior):
  (1) **Hono** — `server.ts` is now a Hono app on `@hono/node-server`
  `serve()`; WS shares the listener via `upgradeWebSocket` +
  `WebSocketServer({noServer:true})` passed to `serve()`'s websocket
  option (`@hono/node-ws` is deprecated; `ws` remains for that server).
  `@hono/zod-validator` validates all bodies against the existing zod
  schemas, reproducing the exact prior 400 messages. Every route/method/
  status/shape preserved (incl. `GET`/`POST /sessions/:runId` +
  `/state`/`/action`), the 202 async run-start + WS broadcasts,
  `redactValue` on all JSON, and the byte-identical WS protocol.
  (2) **`@/` alias** — replaced the 36 NodeNext `./x.js` relative imports
  with `@/x` via tsconfig `paths {"@/*": ["./src/*.js"]}` (the `.js` in
  the mapping triggers the `.js`→`.ts` source substitution so it both
  typechecks and resolves in tsx); build is `tsc && tsc-alias` (rewrites
  `@/x` → `./x.js` in dist).
- **Why:** Owner review — Hono is cleaner than hand-rolled `node:http`
  routing; `@/db` reads better than `./db.js`.
- **Consequences/follow-up:** Captured the two missing genuine proof runs
  into `/evidence/runs/`: an approval-segregation run (different requester
  vs approver, scoped one-time token) and a stuck-take-over handoff run
  (pause → cede → real operator action over WS → resume → success, human
  actions recorded). Engine README + NOTES updated. Gotcha recorded:
  `getCapability` picks latest by `createdAt` and the upsert does not
  refresh it.
- **References:** `apps/engine/src/server.ts`, `tsconfig.json`,
  `apps/engine/NOTES.md`, `/evidence/runs/`; D-041, D-047.

### D-049 — 2026-09-09T11:12:22Z — Review fixes: strict artifact contract, ordered fallback, pinned + honest approvals

- **Status:** accepted (post-review hardening; coordinates with the parallel
  core-policy worker, which owns retry/handoff safety gates — none of those
  were reverted).
- **Decision/change:** Implemented the artifact/replay-contract and
  documentation corrections surfaced by the pre-submission review:
  (1) **Locator schema is now a strict discriminated union** on `strategy`
  (`a11y` requires nonempty `role`+`name`, `css` nonempty `css`, `text`
  nonempty `text`; foreign keys rejected). This rejects the malformed legacy
  probe fallback `{strategy: "text", value: "Member summary"}` at parse time
  instead of silently never matching it. The graded probe artifact
  (`evidence/artifacts/get_member_balances__handoff-probe.json`) is kept
  byte-identical as run history; the correction is documented in
  `evidence/README.md`, not edited into the file.
  (2) **`resolveTarget` is a real ordered fallback chain**: the primary,
  then each fallback IN RECORDED ORDER, each given a short probe window; the
  Playwright `.or().first()` union (which merges matches in DOM order and
  could let a higher-up fallback beat the primary) is gone. An action
  failing on a RESOLVED element still fails for real instead of being
  masked by the remaining fallbacks.
  (3) **Output contract validation**: extract steps coerce + validate each
  value against its declared output type (string/number/boolean/date), a
  successful replay must fill every declared output, and undeclared outputs
  are rejected. The artifact schema now also enforces per-action required
  step fields (navigate→url, click/type/select→target, press→key,
  wait→checkpoint, extract→outputName+extractKind) and unique
  input/output/outcome names via `superRefine`.
  (4) **Approvals pin the immutable artifact**: a request records the
  artifact `version` + a SHA-256 content hash in the intervention context;
  approval resolves that exact version and re-verifies the hash (mismatch →
  409), so the run executes the artifact the operator approved, never a
  mutated "latest". Token consumption is now an atomic conditional UPDATE
  (`… WHERE consumedByRunId IS NULL`), so two approvals cannot both start a
  run off one token.
  (5) **Review state is authoritative in the DB column** and no longer
  bypassable by approval: `requireReviewForRisky` refuses an unreviewed
  risky artifact with OR WITHOUT a token (previously an approval skipped the
  gate), and a re-saved `reviewed:false` artifact cannot strip a review
  another version earned.
  (6) **Docs/setup**: root README gives ONE `pnpm dev` path (no duplicate
  services), the first-run auth migration command, and a discovery→replay
  section that names the returned artifact id + the import/review workflow;
  REPORT claims updated to implementation truth (strict schema, ordered
  fallback, pinned approvals, independent review gate, the honest handoff
  read, no pixel-sensitive screenshot guarantee); the transient-500 evidence
  wording now states the saved probe result is `hard_failure`; the handoff
  proof claim now says the stale PRIMARY (not a working fallback) caused the
  stuck and the malformed fallback never fired.
- **Why:** The review found the artifact contract too permissive (a
  malformed locator shipped), the replay target resolution subtly unordered,
  outputs unvalidated, approvals executing a mutable artifact, and the
  review gate bypassable — plus several documentation claims that had drifted
  from what the runs actually show.
- **Consequences/follow-up:** Behavior change: `POST /approvals` on an
  unreviewed risky capability now answers 409 (request review first), and
  `POST /replay` with an approval token on an unreviewed risky artifact
  fails closed. The frontend's loose locator mirror still parses every
  stored artifact (the strict union is a subset); tightening the mirror is a
  follow-up, not required. No automated tests added (project convention:
  manual verification); schema/db behavior was smoke-checked by execution.
- **References:** `apps/engine/src/artifact.ts`, `src/replay.ts`, `src/db.ts`,
  `src/server.ts`; `README.md`, `REPORT.md`, `evidence/README.md`;
  D-043, D-045, D-047.

### D-050 — 2026-09-09T11:40:06Z — Monorepo-wide conventions: TypeScript-only packages, Hono.js API servers

- **Status:** accepted
- **Decision/change:** Recorded two owner-directed conventions in AGENTS.md
  (## Stack, applying to every workspace package): (1) every package in this
  monorepo is always a TypeScript package — no plain-JavaScript workspace
  members; new packages start as strict TypeScript ESM with the engine-style
  toolchain (`tsx` dev, `tsc` + `tsc-alias` build, ESLint, Prettier, `@/`
  alias). (2) any API server is always Hono.js (`hono` + `@hono/node-server`)
  with zod-validated boundaries, bound to `127.0.0.1` by default.
- **Why:** Owner direction after the mockbank conversion ("make it a
  typescript project and the api server should be Hono.js just like the
  engine"). One server framework and one language across packages keeps the
  repo uniform and reviewable; the mockbank conversion (`e0e0929`) already
  brought the last plain-JS package into line.
- **Consequences/follow-up:** Applies to all future workspace members.
  `apps/engine` and `apps/mockbank` are the reference implementations.
  Existing Next.js frontend conventions are unaffected (it is already
  TypeScript; its server side is Next route handlers, not a standalone API
  server).
- **References:** Owner request; `AGENTS.md` ## Stack; D-048 (engine Hono
  migration); commit `e0e0929` (mockbank TypeScript + Hono conversion).

### D-051 — 2026-09-09T11:52:00Z — Strict locator union keeps legacy `exact`; distill schema reuses TargetSchema

- **Status:** accepted (fixes a regression introduced by D-049's strict union)
- **Decision/change:** (1) The css/text locator variants in
  `apps/engine/src/artifact.ts` now accept an optional `exact` key. Legacy
  stored artifacts (schema before the strict union) carry `exact: true` on
  every variant — e.g. the reviewed `get_member_balances@1.2.1`, whose replay
  hard-failed at parse with `unrecognized_keys`. Strictness still rejects
  genuinely foreign keys (`value` on a text locator, missing `css`/`text`).
  Replay honors `exact` for text locators (default substring) and ignores it
  for css. (2) The frontend mirror `locatorSchema` in
  `apps/frontend/lib/engine/schemas.ts` is now the same strict union.
  (3) `DistilledArtifactSchema` in `apps/engine/src/discovery.ts` now reuses
  the strict `TargetSchema` instead of a duplicate loose shape, so the
  distillation MODEL is constrained to emit parseable locators in the first
  place instead of producing drafts the artifact schema then rejects.
- **Why:** Owner's manual chat test surfaced the parse failure on replay of
  the latest reviewed capability. Backward compatibility with already-stored,
  already-reviewed artifacts is a hard requirement — strictness must reject
  meaningless shapes without invalidating legitimate legacy ones.
- **Consequences/follow-up:** Verified by execution: all LATEST stored
  capability versions parse (get_member_balances@1.2.1, open_sub_account@1.0.0,
  open_savings_sub_account@1.0.0). Two superseded malformed review drafts
  (get_member_balances@1.1.0/1.1.1, text fallback missing its value from the
  D-047 probe work) are still correctly rejected; no execution path resolves
  them (getCapability picks latest by createdAt). Engine + frontend format /
  lint / typecheck / build all pass.
- **References:** Owner's chat bug report; `apps/engine/src/artifact.ts`;
  `apps/engine/src/replay.ts` (toLocator); `apps/engine/src/discovery.ts`;
  `apps/frontend/lib/engine/schemas.ts`; D-049.

### D-052 — 2026-09-09T12:05:00Z — One review flag, kept in sync; approval card wording; seeded chat suggestions

- **Status:** accepted
- **Decision/change:** (1) **Review state now lives in BOTH stores, kept
  consistent.** `setCapabilityReviewed` syncs the embedded
  `artifact.reviewed` alongside the SQL column, and `insertCapability`'s
  review-preserving sync writes both too. The replay + approvals gates read
  the artifact JSON; the catalog reads the column — letting them drift (as
  `open_savings_sub_account@1.0.0` did: column reviewed=1, artifact
  reviewed=false) meant the UI showed a reviewed capability while the engine
  409'd its approval request, so no intervention ever reached the inbox.
  The local dev DB row was healed; the graded evidence rows were already
  consistent. (2) **Approval card wording**: the chat's waiting state now
  says the request is BEING raised in the Interventions inbox (Console →
  Interventions) and that a failed request replaces the card with the error —
  the previous wording asserted the request already existed. (3) **Chat
  suggestions use seeded member 100231** instead of the never-seeded 12345
  (which always answered member_not_found).
- **Why:** Owner report — the chat claimed an approval was pending, but
  Console → Interventions was empty because the engine rejected the request
  at the review gate (409), and the UI copy hid that failure mode.
- **Consequences/follow-up:** Verified by execution: both risky artifacts
  (open_sub_account, open_savings_sub_account) now pass the review gate with
  column and artifact flag consistent; root format / lint / typecheck /
  build all pass. The catalog still shows both ids for the same flow
  (open_sub_account is canonical); consolidating them is a data-migration
  decision for the owner, not done here.
- **References:** Owner's Interventions report; `apps/engine/src/db.ts`;
  `apps/frontend/app/(app)/chat/toolkit.tsx`; `chat-client.tsx`; D-049, D-051.

