# Project instructions

Conventions for working on this repository. Follow these unless the user
overrides them. They are scoped to this project; do not import conventions,
stack choices, or checklists from another repository without verifying them
here first.

**Always save conventions we teach you.** When the user corrects you, teaches a
preference, or establishes a convention, update this file in the same change and
record it in [context/thought-process.md](context/thought-process.md). Do not wait to be asked
twice. Conventions live in the repository, not only in agent memory.

## Read before working

1. Read [context/what-we-are-building.md](context/what-we-are-building.md) for
   the product purpose, required behavior, scope, completion bar, and
   deliverables.
2. Read [context/thought-process.md](context/thought-process.md) for the decision history and
   unresolved choices. Check for later entries that supersede earlier decisions.
3. Consult [context/assignment.md](context/assignment.md) for authoritative
   assignment requirements and [context/email.md](context/email.md) for the
   recruiting context. The product brief is a summary, not a replacement for the
   assignment. Surface conflicts rather than silently changing scope.

## Keep requirements separate from implementation choices

- `context/what-we-are-building.md` describes **what**, not **how**. Keep
  architecture, technology selections, and implementation recipes out of that
  document.
- The project owner explains the implementation approach; the conventions below
  describe the scaffold that exists, not the full architecture. Do not select
  new stack pieces (models, agent frameworks, storage) without the owner's
  direction. Ask when a pending choice blocks work instead of treating an
  assumption as an agreed decision.
- Do not turn examples, optional stretch goals, or design-only considerations
  into required implementation scope.
- Keep the product brief current when scope is explicitly clarified. Record
  agreed implementation decisions in the ledger and, when prepared, the required
  `REPORT.md`.

## Maintain the decision ledger

- Append a timestamped entry to [context/thought-process.md](context/thought-process.md) for
  each meaningful decision, fix, or change. Include the ledger update in the
  related commit where practical.
- Follow the ledger template: stable ID, actual UTC timestamp in ISO 8601
  format, status, decision/change, concise reason, consequences or follow-up,
  and useful references. Clearly distinguish agreed decisions from proposals and
  deferrals.
- Preserve earlier entries. Append a linked superseding entry when a decision
  changes; do not silently rewrite history or invent retrospective timestamps.
- Record concise decision rationales, not raw model transcripts or private
  working notes. Never include secrets, credentials, tokens, or sensitive data.
- The ledger supports the required `REPORT.md`; it does not replace that report
  or run evidence in `/evidence/`.

## Layout

```
package.json            # workspace root; scripts fan out to members
pnpm-workspace.yaml     # covers apps/*; single root pnpm-lock.yaml
apps/
  frontend/             # Next.js 16 + shadcn app (workspace member)
context/                # project knowledge base — research + decisions as markdown
```

The frontend was scaffolded from a shadcn template and follows its structure:

```
app/                    # Next.js App Router (layout.tsx, page.tsx, globals.css)
components/             # React components; components/ui/ = shadcn components
components/theme-provider.tsx  # next-themes provider (`d` toggles dark/light)
hooks/                  # React hooks
lib/utils.ts            # cn() re-exported from the `cn` package
public/
```

## Brand (BankGPT)

The product brand is **BankGPT** (<https://bankgpt.ai/>), not interface.ai's
corporate blue/yellow identity. The full design system lives in
[context/design/DESIGN.md](context/design/DESIGN.md) with machine-readable
tokens in [context/design/tokens.json](context/design/tokens.json); source
assets (logo mark, lockup, favicon, OG reference) are in
[context/design/assets/](context/design/assets/). Summary:

- **Dark-first.** Brand background `#09090B`; cards `#131316`; hairline
  borders are white at 6%. Dark mode is the brand-native mode.
- **Two accents:** emerald `#10B981` (primary actions — button text on
  emerald is deep green `#042F23`, never white) and violet `#8B5CF6` /
  indigo `#6366F1`. Signature gradient: `105deg, #6366F1 → #8B5CF6 42% →
  #10B981`, used on emphasized headline words and stat numerals.
- **Type:** Inter for everything; IBM Plex Mono for uppercase
  eyebrows/labels (letter-spacing `.14em`, emerald-soft `#34D399`).
- **Shape:** buttons and badges are full pills (`border-radius: 100px`);
  cards 14–20px radius.
- **Logo:** two overlapping circles (violet at 85% + emerald) + "BankGPT" in
  Inter 600. App copies live in `apps/frontend/public/` (`bankgpt-logo.svg`,
  `bankgpt-mark.svg`, `favicon.svg` + PNG fallbacks) — **only** the logo and
  favicon go in `public/`; all other design material stays in
  `context/design/`.
- The shadcn theme in `apps/frontend/app/globals.css` implements these
  tokens; keep it in sync with `context/design/DESIGN.md` when the brand
  changes. The OG image is generated from `context/design/og-image.html`
  (headless Chromium, 1200×630) into `context/design/og-image.png`.

## Scope priority

`context/company/`, `context/bankgpt/`, and `context/design/` are reference
material — use them to inform design and product decisions, but they do not
change the deliverable. **The main goal is to complete
[what-we-are-building.md](context/what-we-are-building.md)** (the
computer-use automation assignment). When reference material and the
assignment conflict, the assignment wins; surface the conflict instead of
silently expanding scope.

## Stack

### apps/frontend

- **Next.js 16.2.6** (App Router) + **React 19** + TypeScript strict
- **Tailwind CSS 4** (`@tailwindcss/postcss`) + `tw-animate-css` +
  `shadcn/tailwind.css`, configured in `app/globals.css`
- **shadcn** (`components.json`, style `base-nova`, base color `neutral`, CSS
  variables, RSC mode); add components with `pnpm dlx shadcn add <component>`
- `@base-ui/react` — the underlying primitives shadcn components are built on
  here
- `lucide-react` for icons
- `next-themes` for dark mode (`ThemeProvider` in `app/layout.tsx`; press `d`
  outside text inputs to toggle)
- Path alias: `@/*` → app root (`@/components`, `@/lib/utils`, `@/hooks`)
- Fonts via `next/font/google`: Geist (`--font-sans`) and Geist Mono
  (`--font-mono`) in `app/layout.tsx`
- Scripts: `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm format` (Prettier +
  prettier-plugin-tailwindcss) / `pnpm typecheck`

**Next.js 16 is newer than your training data.** APIs, conventions, and file
structure may differ from what you know. Follow `apps/frontend/AGENTS.md`: read
the relevant guide in `node_modules/next/dist/docs/` before writing Next.js
code, and heed deprecation notices. The `next-best-practices`,
`vercel-composition-patterns`, and `web-design-guidelines` skills are relevant
for frontend work.

#### TanStack libraries and validation (apps/frontend)

- **Charts: `@tanstack/charts`.** Use the compact linear scale from
  `@tanstack/charts/scales/linear` so domains are inferred, the tooltip
  behavior from `@tanstack/charts/tooltip`, and render through the React
  adapter with a useful `ariaLabel`. Preserve the original data rows for
  typed tooltip and focus callbacks; size scatter points with an explicit
  square-root radius scale.
- **Server state: `@tanstack/react-query` (always).** Domain-shaped query
  keys, colocated query functions, optimistic mutations where useful,
  targeted invalidation after writes. Cover loading, error, empty,
  background-refetch, and stale-data states. Keep server data out of global
  client state.
- **Forms: `@tanstack/react-form` (always).** Typed form and field APIs,
  synchronous and debounced async validators, deeply nested object and array
  fields, granular subscriptions so only relevant UI updates. Keep it
  headless and render accessible, product-specific controls.
- **Markdown: `@tanstack/markdown` (always).** Treat its serializable AST as
  the durable document model and render from that tree. Enable only the
  syntax extensions the product needs. Preserve the safe defaults and
  deterministic output; keep syntax highlighting as an explicit external
  integration. For accumulated AI responses, use the streaming profile
  without carrying incremental parser state between updates.
- **Validation: `zod` (always).** Use zod (v4) for all validation — form
  schemas (with `@tanstack/react-form` validators), env-var parsing, API /
  route input, and any external data at a boundary. One schema is the single
  source of truth; derive types with `z.infer<typeof schema>` instead of
  hand-writing matching interfaces. Never write inline regex/manual
  validators in components when a zod schema can express them.

#### AI SDK (apps/frontend)

- **LLM access: `ai` (always) with OpenRouter.** Build AI features and agents
  with the Vercel AI SDK — never hand-rolled provider HTTP clients. Go through
  the official OpenRouter provider (`@openrouter/ai-sdk-provider`,
  `createOpenRouter()`), which reads `OPENROUTER_API_KEY` from the
  environment. Do not add direct provider SDKs (`@ai-sdk/openai`,
  `@ai-sdk/anthropic`, ...) unless the owner asks. Use the `ai-sdk` skill for
  usage questions and `openrouter-models` for model/pricing lookup.
- **Chat/agent UI: `assistant-ui` (always).** Build chat and agent surfaces
  with assistant-ui on the **AI SDK v7 runtime** (`@assistant-ui/react` +
  `@assistant-ui/ai-sdk` + `@ai-sdk/react`) — no custom chat UIs. Route
  handlers stream with `streamText` + `convertToModelMessages` (async in v7)
  and return `createUIMessageStreamResponse`; the client uses
  `useChatRuntime`. Docs are markdown-first: append `.md` to any docs page
  URL, and use the `assistant-ui` skills (`runtime` when choosing/wiring a
  runtime, `elements` for the Thread component set, `streaming`/`tools` for
  those behaviors).

### Database and authentication (apps/frontend)

- **Auth: `better-auth`** (email + password enabled) backed by **SQLite via
  `better-sqlite3`** (v12 — better-auth 1.7 pins that peer range).
- Server config: `lib/auth.ts` (a `better-sqlite3` instance passed as
  `database`); route handler: `app/api/auth/[...all]/route.ts`
  (`toNextJsHandler`); browser client: `lib/auth-client.ts`
  (`createAuthClient` from `better-auth/react`). Server-side session reads use
  `auth.api.getSession({ headers: await headers() })`.
- **SQLite is the app database for everything for now**, not just auth. The
  file lives at `apps/frontend/data/app.sqlite` (override with `DATABASE_URL`)
  and **must stay gitignored** — `data/.gitignore` ignores all contents, and
  `.gitignore` also ignores `/data/*.sqlite` + journal/wal/shm sidecars.
  Commit only the schema and `.env.example`, never the database file.
- Env vars: `BETTER_AUTH_SECRET` (required), `OPENROUTER_API_KEY`
  (required for AI features), `BETTER_AUTH_URL` and `DATABASE_URL`
  (optional) — names only in `apps/frontend/.env.example`, where each
  variable is marked REQUIRED or OPTIONAL.
- **Always create `apps/frontend/.env.local` if it does not exist**, filling
  the required values (`openssl rand -base64 32` for `BETTER_AUTH_SECRET`,
  `http://localhost:3000` for `BETTER_AUTH_URL`). `.env.local` is gitignored;
  never commit it.
- After changing auth config or plugins, re-run the schema migration from
  `apps/frontend`: `pnpm dlx @better-auth/cli@latest migrate --config
  lib/auth.ts`.
- `better-sqlite3` builds a native binding; its build script is allowlisted in
  the root `pnpm-workspace.yaml` (`allowBuilds`), so a plain `pnpm install`
  compiles it.

## Package manager

- **pnpm only.** Never npm or yarn. Pinned via `packageManager` in the root
  `package.json`.
- **This is a pnpm-workspace monorepo**: root `package.json` +
  `pnpm-workspace.yaml` cover `apps/*`, with a single root `pnpm-lock.yaml`.
  Run `pnpm install` from the **repo root**, never inside an app. Add deps
  with `pnpm --filter <pkg> add <dep>` (e.g. `pnpm --filter frontend add zod`).
- **Root scripts fan out to workspace members** (`pnpm -r --if-present`):
  `pnpm run dev` starts the frontend dev server, and `pnpm run build` /
  `lint` / `typecheck` / `format` run across all packages that define them.
  Running the same scripts inside `apps/frontend` also works.

## Linting and formatting

- Lint with **ESLint** (`eslint-config-next` core-web-vitals + typescript) and
  format with **Prettier** + `prettier-plugin-tailwindcss` (config: no
  semicolons, double quotes, es5 trailing commas, 80 cols, `cn`/`cva` class
  sorting against `app/globals.css`).
- After code changes in `apps/frontend`, run `pnpm lint --fix`, then
  `pnpm format`.

## Definition of done

A change is done only when the relevant checks pass **before** the commit — no
red output, no skipped steps, no "it was already broken" (if it is, fix it or
stop and report).

- **`apps/frontend`:** from the repo root, `pnpm run lint` (zero errors
  **and** zero warnings), `pnpm run typecheck` (zero errors), `pnpm run build`
  (production build succeeds). These fan out via `pnpm -r --if-present`;
  running them inside `apps/frontend` is equivalent. Run `pnpm format` before
  linting so Prettier-clean files stay clean. There is no test script yet;
  when one is added, it joins this list.
- **`context/` and `AGENTS.md`:** no checks beyond
  Markdown link/structure sanity and a clean staged diff.
- If a check cannot pass yet (blocked, half-done, waiting on the user), **say
  so and stop** — do not commit or push a red state to `main`. Never weaken
  lint rules, add `eslint-disable`, or use `as any` / `@ts-ignore` to silence a
  failure instead of fixing it.

## Code style

- Comment above the function when the why is not obvious from the code.
- Prefer arrow functions for new code: `const nameOfFunction = () => {}`. This
  is a preference, not a hard rule. Keep `export default function Page() {}`
  for Next.js file-convention exports (`page.tsx`, `layout.tsx`, etc.) and do
  not rewrite existing `function` declarations only to match this style.

## Research and documentation tools

- Use **context7** for current library or framework documentation when it is
  available; fall back to the local installed documentation or built-in tools
  and mention the fallback.
- Use **tavily** for web search when it is available, in preference to the
  built-in `websearch` skill; mention any fallback.
- When a task might match an installed or installable skill, use the
  `find-skills` workflow and follow the matching skill before starting.

## Skills

Project skills live in `.agents/skills/` only (tracked in `skills-lock.json`,
installed via `npx skills add <owner/repo@skill>`). The install CLI also
symlinks them into `.claude/skills/` for Claude Code — that folder is
gitignored; never commit it. **When you add or remove a skill, update this
list in the same change** so every entry says what the skill is for. Use the
relevant skill before starting a matching task:

- `find-skills` (official Vercel) — discover and install more skills
- `vercel-react-best-practices` (official Vercel) — React/Next.js performance
  patterns
- `web-design-guidelines` (official Vercel) — UI review and accessibility
  audits
- `frontend-design` (official Anthropic) — building distinctive, polished
  frontend UI
- `shadcn` (official shadcn) — adding/composing shadcn components
- `better-auth-best-practices` (official Better Auth) — auth server/client
  config, sessions, plugins
- `tailwind-4-docs` — Tailwind CSS v4 docs snapshot (v4 is newer than
  training data)
- `tanstack-query` + `tanstack-form` — TanStack Query/Form patterns
  (unofficial skills; AGENTS.md conventions win on conflict)
- `zod` — schema validation best practices (unofficial; repo is zod v4 —
  prefer repo conventions on API drift)
- `pnpm` (antfu) — pnpm workspace/catalog/patch management
- `ai-sdk` (official Vercel) — AI SDK patterns: generateText/streamText,
  agents, tool calling, structured output, useChat
- `openrouter-models` (official OpenRouter) — OpenRouter model catalog,
  pricing, and capability lookup
- `assistant-ui` (official assistant-ui) — full skill set for building chat
  UIs: `runtime`, `streaming`, `tools`, `primitives`, `elements`,
  `thread-list`, `cloud`, `setup` cover the core; `copilots`,
  `generative-ui`, `markdown`, `observability`, `ink`, `react-mcp`,
  `react-native`, `update` are there if those surfaces ever matter
- `extract-design-system` — extract design tokens from a public website; use
  for the planned `DESIGN.md` from the interface.ai company site
- `code-review`, `tdd`, `diagnosing-bugs`, `codebase-design`,
  `domain-modeling`, `research`, `prototype` (mattpocock) — general
  engineering workflow skills

## Commit and publish changes

- Make a separate, focused commit for each fix or coherent change. Use a short
  commit message with an emoji, such as `📝 Define project scope`. Do not batch
  unrelated work into one commit.
- Check the diff and run checks relevant to the changed files before committing.
  Stage only files belonging to that change. Do not include unrelated user work
  or any secrets.
- Push each commit to the configured GitHub remote after it is made.

### Commit safety

Only plain `git add`, `git commit`, and `git push origin main` are allowed
without asking. Ask the user first before:

- `push --force` or `push --force-with-lease`
- `reset --hard`; `checkout -- <file>` or `restore` on files you did not change
  yourself; `clean -f`
- `rebase`; `commit --amend` on a pushed commit; or any other history rewrite
- Deleting branches or tags
- Deleting or moving files under `context/`

If a push is rejected, report the rejection and the unpublished local commits.
Do not recover by rewriting history unless the user asks.

## Secrets and sensitive data

- Never commit secrets, credentials, tokens, private keys, API keys, or raw
  sensitive personal data.
- Keep raw sensitive values out of source, documentation, artifacts, logs,
  commit messages, and chat output.
- Add the name of a new environment variable, without its value, to the owning
  package's committed example environment file when one exists.
- If you find a secret that is already committed, stop and tell the user. Do
  not rewrite history on your own.

## Documentation and code quality

- Markdown files may be out of sync. Verify claims from documentation against
  current files, execution results, or git history before acting on them.

## Context folder

- Treat `context/` as shared project knowledge. Keep it concise, current, and
  factual. Cite source files, URLs, commands, or verified results where useful.
- Keep assignment sources and project decisions separate:
  [assignment](context/assignment.md) and [email](context/email.md) are source
  material, [the product brief](context/what-we-are-building.md) summarizes the
  required product and scope, and [the ledger](context/thought-process.md) records
  decisions.
- Do not create raw data dumps. Extract useful facts into Markdown instead.
- Do not introduce an architecture, brand, layout, or package-manager
  convention from another repository until it is verified against this one.

## File naming

- Use **kebab-case** filenames: `theme-provider.tsx`, `use-wallet.ts`.
- React components still export PascalCase names.
