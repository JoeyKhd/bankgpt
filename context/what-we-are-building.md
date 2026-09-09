# What we are building

## Purpose and source of truth

We are building a small, working **computer-use automation system** for the
interface.ai engineering take-home assignment. It is the backend integration
layer that lets an AI agent complete work inside applications that have no API.

This document describes **what the system must do and what we must deliver**.
It does not choose how we will build it. The implementation approach remains
open for the project owner to explain and decide later.

Sources:

- [Assignment](assignment.md): the authoritative requirements, scope,
  evaluation criteria, and submission instructions.
- [Recruiting email](email.md): confirms the purpose, public GitHub
  submission, lack of a deadline, and expectation that we can defend our work.

This is a summary, not a replacement for the assignment. If they differ, consult
the assignment and record any agreed clarification in
[the decision ledger](thought-process.md).

## The product in one sentence

**An LLM discovers how to complete a task in a real UI; the successful run becomes
a reusable, reviewable, parameterized capability that an AI agent can replay
without model decisions.**

The calling AI agent decides what work needs doing. This system carries out that
work reliably and safely in the target application. When an API exists, using it
is the preferred integration path, but API-based integration is outside this
assignment.

## Who and what this serves

- **Calling AI agents** supply a goal during discovery, then invoke a saved
  capability with inputs and receive clear results during replay.
- **Human operators** intervene when the system cannot safely continue, operate
  the same live session, and return control to automation.
- **Reviewers and maintainers** need to understand a capability's contract and
  inspect evidence of what happened, why a run stopped, and what was handed off.

The real setting is back-office software used by US banks and credit unions.
The assignment will use a proxy target, not a real bank system. No particular
application or workflow has been selected yet.

## Real-world constraints the design must account for

- **Stable interfaces, real runtime problems.** Validation errors, missing
  records, permission denials, unexpected dialogs, expired sessions, slow loads,
  and application failures matter more than constant layout changes. A happy-path
  recording alone is not enough.
- **Mixed and legacy surfaces.** Applications may be modern web, legacy web, or
  native desktop software. A clean DOM, stable selectors, test IDs, and APIs cannot
  be assumed. The visible interface may be the only reliable surface.
- **Reuse across institutions.** Hundreds of tenants run roughly 20 applications
  each. Many share a vendor product but differ in configuration, branding, and
  version. The design must explain safe reuse, specialization, and drift handling
  rather than requiring a new recording for every tenant.
- **Sensitive data and consequential actions.** These are regulated financial
  workflows. Safety and data handling apply throughout discovery, replay,
  evidence collection, and human intervention.

Only one concrete surface must be implemented. Desktop and multi-tenant support
are design considerations, not required production implementations.

## Required end-to-end behavior

The working slice must connect all of these capabilities, not just demonstrate
isolated pieces.

### 1. Discover a flow from a goal

Accept a natural-language goal and a target application or entry point. Use a
real LLM-driven observe → decide → act loop to interact with a live UI, including
reading state and taking actions. Stop when the goal is met or a limit, timeout,
or dead-end is reached.

At least one successful discovery run must be genuine and backed by evidence.
A scripted imitation or a description of an agent is not a substitute.

### 2. Save a reusable capability

After a successful run, emit a typed, serializable, versioned, reviewable artifact
that is separate from the raw model transcript. Its contract must express:

- The ordered actions.
- How each target element or control is identified, with an explanation of its
  robustness.
- Typed input parameters supplied for each invocation.
- Typed outputs, including what data is extracted and its shape.
- A checkpoint or success condition.

Both a human reviewer and a calling agent should be able to understand what the
capability does, what it needs, and what it returns. The schema and storage format
are not chosen here.

### 3. Replay without model decisions

Given a saved capability and input parameters, execute the recorded flow without
invoking an LLM for decisions. Replay must use stable targeting, verify the
success condition, and return the declared outputs.

It must detect exceptional states and distinguish:

- **Expected business outcomes:** for example, a member does not exist. This is
  an answer for the caller, not a system crash.
- **Recoverable conditions:** a known interruption or transient load problem
  that can be handled deliberately before continuing.
- **Hard failures:** conditions that must stop execution and provide a clear,
  debuggable error.

The caller must receive a structured result: success with outputs, a known
business outcome, or failure details that identify the step, expected state,
and observed state. Replay must not blindly continue after an error.

### 4. Stay within policy and protect data

Enforce an explicit, configurable allowlist of permitted scope and actions.
Distinguish safe or reversible actions from risky or irreversible ones and treat
the risky class conservatively. The exact policy for those actions is still open.

Never persist secrets or raw sensitive data, including credentials, tokens, or
full personally identifiable information, in artifacts or logs. Redact evidence
appropriately and keep secrets out of the public repository. Use no real
credentials or real personal data when exercising a public proxy target.

### 5. Produce useful evidence

Keep structured run logs of actions and their reasons, plus at least one richer
failure signal, such as a screenshot, snapshot, or trace. The specific evidence
format is not selected here. Evidence must support review and debugging without
leaking sensitive data.

### 6. Escalate and transfer control

Detect when discovery or replay is stuck, cannot recover, or needs a human safety
decision. Route an intervention request with the goal or capability, current
step, current state, and reason for stopping.

A human must be able to take over **the same live session**, perform manual steps,
and hand control back so the run can resume or complete. Preserve context and
evidence, record the human's actions, and make control ownership explicit.

A minimal or mocked operator interface is acceptable. The pause, control
transfer, and resume mechanism must be real. A full real-time co-browsing console
is not required.

### 7. Explain the path beyond the chosen surface

The design write-up must explain how the capability and replay concepts could
extend to legacy web and desktop surfaces. It must also address reuse and safe
specialization across tenants and vendor versions, including detection and
management of drift. Those design choices remain open; this document only
records the requirement to address them.

## Scope and completion bar

Build a focused, thin-but-real vertical slice:

**Goal → genuine LLM discovery → saved capability → deterministic replay with
inputs, outputs, and error handling → live-session human escalation**, with
evidence from discovery and replay.

- Exercise a non-trivial, multi-step workflow on one proxy application. Examples
  in the assignment are illustrations, not our selected target or feature list.
- Touch every core requirement. Cut depth rather than omit entire capabilities.
- Keep any permitted mocks or stubs explicit and explain their limits.
- Do not seek access to a real bank system. Respect any public target's terms
  and rate limits and do not harm the service.
- Do not expand this into a polished product, full operator console, desktop
  implementation, or multi-tenant infrastructure project.
- Treat stretch goals as optional, not commitments. Select at most one or two,
  and only after the core works.
- Document deliberate cuts and next steps. There is no submission deadline, but
  the assignment expects a self-imposed time box and focused effort.

AI-assisted development is expected and encouraged. We remain responsible for
understanding and defending everything submitted. A real discovery run requires
our own model API access; the provider and model are not yet selected.

## Required deliverables

Use the assignment's exact paths and report headings:

1. **Public GitHub repository with source code.**
2. **`/README.md`** with setup and run instructions, required keys/configuration,
   how to run without live services where applicable, and exact demo commands
   for discovery followed by replay of the resulting artifact.
3. **`/REPORT.md`**, approximately 1–3 pages, using these seven headings:
   - Architecture
   - Artifact schema
   - Determinism & error handling
   - Heterogeneity & multi-tenant
   - Escalation & handoff
   - Safety
   - Cuts
4. **`/evidence/`** with a saved example artifact and logs from both a genuine
   discovery run and a replay run. An example replay that encounters an error or
   exceptional state is recommended. A short screen recording is optional.

   > **Implementation note (D-059):** the assignment text above specifies a
   > `/evidence/` folder, but per owner direction all run evidence is stored in
   > the engine SQLite DB (`run_files` table) and served over the engine HTTP
   > API (`/runs/:id/evidence`, `/runs/:id/files[/:name]`) instead. This is a
   > deliberate supersession of the literal deliverable path — flagged here
   > rather than silently changed. See the ledger.
5. **Submission email** to `assignments@interface.ai`, sent from the address used
   to apply, with the public repository URL on its own line. Do not send a zip.

The local [decision ledger](thought-process.md) supports the eventual write-up.
It is our project convention, not an additional deliverable specified by the
assignment, and it does not replace `/REPORT.md` or runtime evidence.

## What will be evaluated

In roughly the assignment's priority order:

1. System design, especially the artifact and replay contracts.
2. Correctness of real discovery and deterministic replay.
3. Robustness and explicit runtime error handling.
4. Real human escalation and live-session handoff.
5. A credible design for heterogeneous surfaces and multi-tenant reuse.
6. Safety and sensitive-data handling.
7. Readable, reasonably typed code, meaningful tests, and ease of running.
8. Clear communication of decisions, trade-offs, and cuts.

Feature breadth, framework name-dropping, and premature scaling infrastructure
are not the goal.

## Decisions reserved for later

No choices are made here about the language, runtime, frameworks, model/provider,
computer-use technology, target application, workflow, architecture, artifact
schema or storage, targeting and waiting strategy, recovery rules, risky-action
policy, operator interface, or evidence tooling. The extension and tenant-reuse
designs are also unresolved.

The project owner will explain the implementation approach later. Record agreed
decisions and concise reasons in [thought-process.md](thought-process.md) as they
are made. Do not treat requirements or illustrative examples as implementation
choices.
