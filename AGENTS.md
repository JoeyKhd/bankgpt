# Project instructions

## Read before working

1. Read [context/what-we-are-building.md](context/what-we-are-building.md) for the
   product purpose, required behavior, scope, completion bar, and deliverables.
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

- Append a timestamped entry to [thought-process.md](thought-process.md) for each
  meaningful decision, fix, or change. Include the ledger update in the related
  commit where practical.
- Follow the ledger template: stable ID, actual UTC timestamp in ISO 8601 format,
  status, decision/change, concise reason, consequences or follow-up, and useful
  references. Clearly distinguish agreed decisions from proposals and deferrals.
- Preserve earlier entries. Append a linked superseding entry when a decision
  changes; do not silently rewrite history or invent retrospective timestamps.
- Record concise decision rationales, not raw model transcripts or private
  working notes. Never include secrets, credentials, tokens, or sensitive data.
- The ledger supports the required `REPORT.md`; it does not replace that report
  or run evidence in `/evidence/`.

## Commit and publish changes

- Make a separate, focused commit for each fix or coherent change. Use a short
  commit message with an emoji, such as `📝 Define project scope`.
- Check the diff and run checks relevant to the changed files before committing.
  Stage only files belonging to that change. Do not include unrelated user work
  or any secrets.
- Push the commits to the configured GitHub remote. Do not force-push or rewrite
  published history unless explicitly requested. If a push is blocked, report
  the blocker and identify the local commits that remain unpublished.
