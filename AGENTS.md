# Project instructions

Conventions for working on this repository. Follow these unless the user
overrides them. They are scoped to this project; do not import conventions,
stack choices, or checklists from another repository without verifying them
here first.

**Always save conventions we teach you.** When the user corrects you, teaches a
preference, or establishes a convention, update this file in the same change and
record it in [thought-process.md](thought-process.md). Do not wait to be asked
twice. Conventions live in the repository, not only in agent memory.

## Read before working

1. Read [context/what-we-are-building.md](context/what-we-are-building.md) for
   the product purpose, required behavior, scope, completion bar, and
   deliverables.
2. Read [thought-process.md](thought-process.md) for the decision history and
   unresolved choices. Check for later entries that supersede earlier decisions.
3. Consult [context/assignment.md](context/assignment.md) for authoritative
   assignment requirements and [context/email.md](context/email.md) for the
   recruiting context. The product brief is a summary, not a replacement for the
   assignment. Surface conflicts rather than silently changing scope.

## Keep requirements separate from implementation choices

- `context/what-we-are-building.md` describes **what**, not **how**. Keep
  architecture, technology selections, and implementation recipes out of that
  document.
- The project owner will explain the implementation approach later. Do not
  select a stack, model, target application, schema, or other implementation
  strategy before that direction is provided. Ask when a pending choice blocks
  work instead of treating an assumption as an agreed decision.
- Do not turn examples, optional stretch goals, or design-only considerations
  into required implementation scope.
- Keep the product brief current when scope is explicitly clarified. Record
  agreed implementation decisions in the ledger and, when prepared, the required
  `REPORT.md`.

## Maintain the decision ledger

- Append a timestamped entry to [thought-process.md](thought-process.md) for
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

## Research and documentation tools

- Use **context7** for current library or framework documentation when it is
  available; fall back to the local installed documentation or built-in tools
  and mention the fallback.
- Use **tavily** for web search when it is available, in preference to the
  built-in `websearch` skill; mention any fallback.
- When a task might match an installed or installable skill, use the
  `find-skills` workflow and follow the matching skill before starting.

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
- If you find a secret that is already committed, stop and tell the user. Do not
  rewrite history on your own.

## Documentation and code quality

- Markdown files may be out of sync. Verify claims from documentation against
  current files, execution results, or git history before acting on them.
- For `context/`, `thought-process.md`, and this file, check Markdown links,
  structure, and the staged diff. No other checks are currently defined for
  documentation-only changes.
- Before an implementation change, run the checks relevant to the files and
  tools being changed. If a required check is blocked, stop and report it
  instead of committing a known-broken state. Never weaken a check, bypass a
  rule, or silence an error just to make a change pass.
- Use kebab-case filenames for new files unless an existing project convention
  requires otherwise.

## Context folder

- Treat `context/` as shared project knowledge. Keep it concise, current, and
  factual. Cite source files, URLs, commands, or verified results where useful.
- Keep assignment sources and project decisions separate:
  [assignment](context/assignment.md) and [email](context/email.md) are source
  material, [the product brief](context/what-we-are-building.md) summarizes the
  required product and scope, and [the ledger](thought-process.md) records
  decisions.
- Do not create raw data dumps. Extract useful facts into Markdown instead.
- Do not introduce a stack, architecture, brand, layout, or package-manager
  convention from another repository until the project owner explains how this
  project will be built.
