/**
 * Deterministic replay (assignment §3.3): the production execution path.
 *
 * Given a saved capability artifact and typed input parameters, replay
 * executes the recorded steps WITHOUT any model calls:
 *
 * - targets resolve by primary a11y locator (role + accessible name), then
 *   fall back through the recorded CSS path and visible text, with explicit
 *   waits — never pixel coordinates;
 * - `{{input}}` placeholders substitute validated, typed input parameters;
 * - `extract` steps fill the declared outputs;
 * - after each step, the business-outcome detect rules are checked, and at
 *   the end the checkpoint must hold;
 * - nothing continues blindly: every failure becomes a structured result
 *   (success | business_outcome | recoverable | hard_failure).
 */
import type { Browser, Page, Locator } from "playwright"
import {
  CapabilityArtifactSchema,
  type CapabilityArtifact,
  type CapabilityStep,
  type Target,
  type Checkpoint,
} from "./artifact.js"
import type { RunResult } from "./results.js"
import {
  assertUrlAllowed,
  assertActionAllowed,
  requireApproval,
  ApprovalRequiredError,
  type Policy,
} from "./policy.js"
import { attachDialogHandler } from "./dialogs.js"
import type { EvidenceWriter } from "./evidence.js"
import { waitWhileNotAutomation, type LiveSession } from "./session.js"

/** Inputs as supplied by the caller (validated against the artifact). */
export type ReplayInputs = Record<string, string | number | boolean>

export type ReplayEvents = {
  /** Fired after each step resolves (ok or failed). */
  onStep?: (stepIndex: number, step: CapabilityStep, ok: boolean) => void
}

const DEFAULT_TIMEOUT_MS = 10_000
/** Transient conditions get this many attempts before we give up. */
const MAX_STEP_ATTEMPTS = 3

/**
 * The app answered a navigation with a transient server error page (the
 * target's "Core system unavailable — try again" 500). Retried like any
 * transient condition; the retry loop reloads the page before re-driving.
 */
class TransientServerError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`transient server error page (HTTP ${status})`)
    this.name = "TransientServerError"
    this.status = status
  }
}

/**
 * Control-flow signal, not a failure: a business outcome matched while a
 * step checkpoint was about to be checked. The retry loop rethrows it
 * untouched; the run loop turns it into the business_outcome result without
 * waiting out the checkpoint timeout.
 */
class BusinessOutcomeInterrupt extends Error {
  readonly outcome: { code: string; detail: string }
  constructor(outcome: { code: string; detail: string }) {
    super(`business outcome during step: ${outcome.code}`)
    this.name = "BusinessOutcomeInterrupt"
    this.outcome = outcome
  }
}

/** Substitute `{{inputName}}` placeholders using validated inputs. */
const substitute = (template: string, inputs: ReplayInputs): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => {
    if (!(name in inputs)) {
      // An OPTIONAL input the caller omitted substitutes as empty (e.g. the
      // demo teller console accepts blank credentials); a REQUIRED input is
      // caught earlier by validateInputs, so this is never a silent skip.
      return ""
    }
    return String(inputs[name])
  })

/**
 * Validate caller inputs against the artifact's declared input contract.
 * Returns a clean, typed input map; throws on missing/invalid required inputs.
 */
export const validateInputs = (
  artifact: CapabilityArtifact,
  inputs: ReplayInputs
): ReplayInputs => {
  const clean: ReplayInputs = {}
  for (const spec of artifact.inputs) {
    const raw = inputs[spec.name]
    if (raw === undefined || raw === "") {
      if (spec.required) {
        throw new Error(
          `missing required input "${spec.name}": ${spec.description}`
        )
      }
      continue
    }
    switch (spec.type) {
      case "string":
        clean[spec.name] = String(raw)
        break
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw)
        if (Number.isNaN(n)) {
          throw new Error(
            `input "${spec.name}" must be a number, got ${JSON.stringify(raw)}`
          )
        }
        clean[spec.name] = n
        break
      }
      case "boolean":
        clean[spec.name] = raw === true || raw === "true"
        break
      case "enum": {
        const v = String(raw)
        if (spec.values && !spec.values.includes(v)) {
          throw new Error(
            `input "${spec.name}" must be one of ${spec.values.join(", ")}, got "${v}"`
          )
        }
        clean[spec.name] = v
        break
      }
    }
  }
  return clean
}

/** Build a Playwright locator for one recorded locator candidate. */
const toLocator = (page: Page, candidate: Target["primary"]): Locator => {
  switch (candidate.strategy) {
    case "a11y":
      return page.getByRole(candidate.role as never, {
        name: candidate.name ?? "",
        exact: candidate.exact,
      })
    case "css":
      return page.locator(candidate.css ?? "")
    case "text":
      return page.getByText(candidate.text ?? "", { exact: false })
  }
}

/** Short human-readable description of a locator, for logs and errors. */
const describeLocator = (candidate: Target["primary"]): string => {
  switch (candidate.strategy) {
    case "a11y":
      return `${candidate.role}[name=${JSON.stringify(candidate.name ?? "")}]`
    case "css":
      return `css(${candidate.css ?? ""})`
    case "text":
      return `text(${JSON.stringify(candidate.text ?? "")})`
  }
}

/** Resolve a recorded target to a live locator: primary first, then fallbacks. */
const resolveTarget = (page: Page, target: Target): Locator => {
  const candidates = [target.primary, ...target.fallbacks]
  // first() on the OR chain: Playwright resolves the first candidate that
  // matches, in recorded order, when the locator is awaited.
  return candidates.map((c) => toLocator(page, c)).reduce((acc, l) => acc.or(l))
}

/** Assert one checkpoint condition set against the live page. */
const checkCheckpoint = async (
  page: Page,
  checkpoint: Checkpoint
): Promise<{ ok: boolean; detail: string }> => {
  const timeout = checkpoint.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (checkpoint.urlPattern) {
    try {
      await page.waitForURL(new RegExp(checkpoint.urlPattern), { timeout })
    } catch {
      return {
        ok: false,
        detail: `URL ${page.url()} did not match /${checkpoint.urlPattern}/ within ${timeout}ms`,
      }
    }
  }
  if (checkpoint.visibleText) {
    try {
      await page
        .getByText(checkpoint.visibleText, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout })
    } catch {
      return {
        ok: false,
        detail: `visible text "${checkpoint.visibleText}" not found within ${timeout}ms`,
      }
    }
  }
  if (checkpoint.elementPresent) {
    try {
      await resolveTarget(page, checkpoint.elementPresent)
        .first()
        .waitFor({ state: "attached", timeout })
    } catch {
      return {
        ok: false,
        detail: `expected element ${describeLocator(checkpoint.elementPresent.primary)} not present within ${timeout}ms`,
      }
    }
  }
  return { ok: true, detail: "checkpoint holds" }
}

/** Check whether any declared business outcome currently matches the page. */
const detectBusinessOutcome = async (
  page: Page,
  artifact: CapabilityArtifact,
  suppress: string[] = []
): Promise<{ code: string; detail: string } | undefined> => {
  for (const outcome of artifact.businessOutcomes) {
    if (suppress.includes(outcome.code)) continue
    const urlOk = outcome.detect.urlPattern
      ? new RegExp(outcome.detect.urlPattern).test(page.url())
      : true
    let textOk = true
    if (outcome.detect.visibleText) {
      textOk =
        (await page
          .getByText(outcome.detect.visibleText, { exact: false })
          .count()) > 0
    }
    if (urlOk && textOk) {
      return { code: outcome.code, detail: outcome.description }
    }
  }
  return undefined
}

/** Execute one step against the page, substituting inputs. */
const executeStep = async (
  page: Page,
  step: CapabilityStep,
  inputs: ReplayInputs,
  consumedInputs: Set<string>
): Promise<string> => {
  switch (step.action) {
    case "navigate": {
      if (!step.url) throw new Error("navigate step needs a url")
      const url = substitute(step.url, inputs)
      await page.goto(url, { waitUntil: "domcontentloaded" })
      return `navigated to ${url}`
    }
    case "click": {
      if (!step.target) throw new Error("click step needs a target")
      await resolveTarget(page, step.target).first().click()
      return `clicked ${describeLocator(step.target.primary)}`
    }
    case "type": {
      if (!step.target) throw new Error("type step needs a target")
      const value = step.value ? substitute(step.value, inputs) : ""
      const locator = resolveTarget(page, step.target).first()
      // A consumed input's value is already echoed in the re-rendered field;
      // filling again would retype the same value. Skip the fill.
      if (step.input && consumedInputs.has(step.input)) {
        return `skipped retype of consumed input "${step.input}" in ${describeLocator(step.target.primary)}`
      }
      await locator.fill(value)
      if (step.input) consumedInputs.add(step.input)
      return `typed into ${describeLocator(step.target.primary)}`
    }
    case "select": {
      if (!step.target) throw new Error("select step needs a target")
      const value = step.value ? substitute(step.value, inputs) : ""
      await resolveTarget(page, step.target)
        .first()
        .selectOption({ label: value })
      return `selected "${value}" in ${describeLocator(step.target.primary)}`
    }
    case "press": {
      if (!step.key) throw new Error("press step needs a key")
      if (step.target) {
        await resolveTarget(page, step.target).first().press(step.key)
      } else {
        await page.keyboard.press(step.key)
      }
      return `pressed ${step.key}`
    }
    case "wait": {
      if (!step.checkpoint) throw new Error("wait step needs a checkpoint")
      const res = await checkCheckpoint(page, step.checkpoint)
      if (!res.ok) throw new Error(res.detail)
      return `waited: ${res.detail}`
    }
    case "extract":
      // Handled by the caller — extraction fills outputs, no page mutation.
      return "extract"
  }
}

/** Run one extract step and return the captured output value. */
const executeExtract = async (
  page: Page,
  step: CapabilityStep
): Promise<string | number | boolean> => {
  switch (step.extractKind ?? "text") {
    case "text": {
      if (!step.target) throw new Error("extract(text) needs a target")
      const text = await resolveTarget(page, step.target).first().innerText()
      return text.trim()
    }
    case "value": {
      if (!step.target) throw new Error("extract(value) needs a target")
      return await resolveTarget(page, step.target).first().inputValue()
    }
    case "page-text-match": {
      if (!step.pattern)
        throw new Error("extract(page-text-match) needs a pattern")
      const body = await page.locator("body").innerText()
      // Whitespace-normalize before matching: legacy table layouts render
      // cell boundaries as newlines, and \s in the pattern must match them.
      const normalized = body.replace(/\s+/g, " ")
      const match = normalized.match(new RegExp(step.pattern))
      // With several groups the LAST one is the value (earlier groups are
      // anchors, e.g. the nickname column before the balance column).
      const value = match?.slice(1).findLast((g) => g !== undefined)
      if (!match || value === undefined) {
        throw new Error(`pattern /${step.pattern}/ did not match page text`)
      }
      return value.trim()
    }
  }
}

export type ReplayOptions = {
  browser: Browser
  artifact: unknown
  inputs: ReplayInputs
  policy: Policy
  evidence: EvidenceWriter
  runId: string
  /** True when an approval token for this run was verified by the caller. */
  approved: boolean
  events?: ReplayEvents
  /**
   * The registered live session this run operates on (server path). When
   * present, the run drives the session's page (never closes it) and blocks
   * before every action while the session is paused or human-owned.
   */
  session?: LiveSession
  /**
   * Live-session handoff (assignment §3.6): when a step fails all attempts
   * and no business outcome matches, the run calls this BEFORE declaring a
   * hard failure. The implementation raises an intervention and waits for
   * an operator; returning true re-drives the failed step against the
   * (human-adjusted) page, false fails the run.
   */
  handoff?: {
    onStuck: (info: {
      stepIndex: number
      intent: string
      expected: string
      observed: string
    }) => Promise<boolean>
  }
}

/**
 * Replay a capability artifact deterministically. No LLM is involved.
 * Returns the structured result taxonomy; never throws for runtime
 * conditions (throws only for a malformed artifact/inputs — caller bugs).
 */
export const replayCapability = async (
  options: ReplayOptions
): Promise<RunResult> => {
  const startedAt = Date.now()
  const artifact = CapabilityArtifactSchema.parse(options.artifact)
  const inputs = validateInputs(artifact, options.inputs)
  const { policy, evidence } = options
  const capabilityId = artifact.id
  const durationMs = () => Date.now() - startedAt

  // Policy: risky capabilities need approval (and, per policy, review).
  requireApproval(policy, { risk: artifact.risk, approved: options.approved })
  // An UNREVIEWED risky capability is not operator-trusted yet: without an
  // explicit approval token, refuse to execute its mutations.
  if (
    policy.requireReviewForRisky &&
    artifact.risk === "risky" &&
    !artifact.reviewed &&
    !options.approved
  ) {
    throw new ApprovalRequiredError(
      `risky capability "${artifact.id}" is not reviewed (reviewed: false)`
    )
  }

  // Server runs drive a registered live session's page (handoff-capable);
  // CLI runs create and own a private context.
  const context = options.session
    ? options.session.context
    : await options.browser.newContext()
  const page = options.session ? options.session.page : await context.newPage()
  // Native confirm/alert dialogs (e.g. the "open this sub-account?" gate) are
  // answered per policy and logged; auto-accept keeps recorded flows moving.
  attachDialogHandler(page, policy, evidence, options.runId)
  // Track the last main-document response status so transient 5xx pages
  // (the target's "Core system unavailable — try again") are detectable.
  let lastMainStatus: number | undefined
  page.on("response", (response) => {
    if (
      response.request().isNavigationRequest() &&
      response.frame() === page.mainFrame()
    ) {
      lastMainStatus = response.status()
    }
  })
  const outputs: Record<string, string | number | boolean> = {}
  let stepsExecuted = 0
  // Inputs already typed by a successful step. When a later page re-render
  // (validation error, transient reload) re-drives the flow, these steps are
  // NOT retyped — the app echoes the submitted values back, and retyping the
  // same key would double it. Re-driving uses the echoed value instead.
  const consumedInputs = new Set<string>()

  // Bootstrap: replay must START at the recorded surface. When the first
  // step is not itself a navigate, open the artifact's targetApp first.
  if (artifact.steps[0]?.action !== "navigate") {
    const entryUrl = artifact.targetApp
    assertUrlAllowed(policy, entryUrl)
    await page.goto(entryUrl, { waitUntil: "domcontentloaded" })
  }
  // A pre-login bootstrap navigation is never session-counted by the target,
  // but if it ever 500s, reset the tracker so the step loop can recover.
  if (lastMainStatus !== undefined && lastMainStatus >= 500) {
    lastMainStatus = undefined
  }

  const fail = async (
    step: number,
    expected: string,
    observed: string
  ): Promise<RunResult> => {
    // Rich failure signal: screenshot + aria snapshot.
    try {
      const screenshot = await page.screenshot({ fullPage: true })
      const aria = await page.ariaSnapshot().catch(() => undefined)
      evidence.writeFailureSnapshot(step, screenshot, aria)
    } catch {
      // Evidence capture must never mask the original failure.
    }
    return {
      status: "hard_failure",
      capabilityId,
      step,
      expected,
      observed,
      evidenceDir: evidence.runDir,
      durationMs: durationMs(),
    }
  }

  // Steps that already escalated to a human once (bounded: one handoff
  // per step — if the fix did not hold, the run fails for real).
  const handoffUsed = new Set<number>()

  try {
    for (let i = 0; i < artifact.steps.length; i++) {
      const step = artifact.steps[i]!
      const stepStart = Date.now()
      assertActionAllowed(policy, step.action)
      requireApproval(policy, {
        risk: artifact.risk,
        action: step.action,
        approved: options.approved,
      })

      let lastError: unknown
      let ok = false
      let detail = ""
      // Deliberate retry for transient conditions (slow loads, races).
      for (let attempt = 1; attempt <= MAX_STEP_ATTEMPTS; attempt++) {
        // Live-session control gate: automation acts only while it owns the
        // session and is not paused (pause/cede arrive over the WS channel).
        if (options.session) await waitWhileNotAutomation(options.session)
        try {
          // Transient-5xx recovery: if the LAST action landed on the app's
          // transient error page ("Core system unavailable — try again"),
          // reload the idempotent page and re-drive the step. A 5xx answers a
          // GET render; the recorded step is replayed against the reloaded
          // page. Bounded by policy.transientErrorMaxReloads.
          for (
            let reloads = 0;
            lastMainStatus !== undefined &&
            lastMainStatus >= 500 &&
            reloads < policy.transientErrorMaxReloads;
            reloads++
          ) {
            evidence.logStep({
              runId: options.runId,
              stepIndex: i,
              at: new Date().toISOString(),
              action: "transient-reload",
              target: page.url(),
              reason: `last navigation answered HTTP ${lastMainStatus}; reloading the page and retrying (reload ${reloads + 1}/${policy.transientErrorMaxReloads})`,
              durationMs: 0,
              result: "ok",
            })
            await page.waitForTimeout(400 * (reloads + 1))
            await page.reload({ waitUntil: "domcontentloaded" })
          }

          // The page may have moved; re-assert scope before acting.
          if (page.url() !== "about:blank") {
            assertUrlAllowed(policy, page.url())
          }
          if (step.action === "extract") {
            const value = await executeExtract(page, step)
            if (step.outputName) outputs[step.outputName] = value
            detail = `extracted ${step.outputName}=${JSON.stringify(value)}`
          } else {
            detail = await executeStep(page, step, inputs, consumedInputs)
          }
          // The action itself may have navigated into a transient 5xx page
          // (e.g. a click whose target page 500s). Surface it so the NEXT
          // attempt reloads instead of resolving locators on the error page.
          if (lastMainStatus !== undefined && lastMainStatus >= 500) {
            throw new TransientServerError(lastMainStatus)
          }
          if (step.checkpoint && step.action !== "wait") {
            // A business outcome may already match (e.g. a validation error
            // re-render): fail FAST instead of waiting out the checkpoint.
            // Unsuppressed — a checkpoint failure with a matching outcome is
            // the answer, same rule as the post-step failure path.
            const early = await detectBusinessOutcome(page, artifact)
            if (early) throw new BusinessOutcomeInterrupt(early)
            const res = await checkCheckpoint(page, step.checkpoint)
            if (!res.ok)
              throw new Error(`step checkpoint failed: ${res.detail}`)
          }
          ok = true
          break
        } catch (err) {
          lastError = err
          // Policy violations and a matched business outcome propagate
          // untouched; only wait-like/transient failures are retried.
          if (
            err instanceof Error &&
            (err.name === "PolicyViolationError" ||
              err.name === "ApprovalRequiredError" ||
              err.name === "BusinessOutcomeInterrupt")
          ) {
            throw err
          }
          if (attempt < MAX_STEP_ATTEMPTS) {
            await page.waitForTimeout(500 * attempt)
          }
        }
      }

      stepsExecuted = i + 1
      evidence.logStep({
        runId: options.runId,
        stepIndex: i,
        at: new Date(stepStart).toISOString(),
        action: step.action,
        target: step.target ? describeLocator(step.target.primary) : step.url,
        reason: ok && detail ? `${step.intent} — ${detail}` : step.intent,
        durationMs: Date.now() - stepStart,
        result: ok ? "ok" : "failed",
        error: ok ? undefined : String(lastError),
      })
      options.events?.onStep?.(i, step, ok)

      if (ok) {
        // Step passed: expected business outcome? That is an ANSWER — stop
        // cleanly. `suppressOutcomes` keeps codes whose detect text also
        // matches this step's healthy page (e.g. a validation-error string
        // that shares words with the form) from short-circuiting the flow.
        const outcome = await detectBusinessOutcome(
          page,
          artifact,
          step.suppressOutcomes ?? []
        )
        if (outcome) {
          return {
            status: "business_outcome",
            capabilityId,
            outcome: outcome.code,
            detail: outcome.detail,
            stepsExecuted,
            durationMs: durationMs(),
          }
        }
      } else {
        // Step failed: it may still BE an expected business outcome (e.g. a
        // validation error re-render that fails the step's checkpoint). All
        // outcomes apply here — suppression only guards the healthy path —
        // and a legitimate answer wins over the step error.
        const outcome = await detectBusinessOutcome(page, artifact)
        if (outcome) {
          evidence.logStep({
            runId: options.runId,
            stepIndex: i,
            at: new Date().toISOString(),
            action: "outcome-probe",
            target: page.url(),
            reason: `step failed but the page matches business outcome "${outcome.code}" — reporting the outcome, not the failure`,
            durationMs: 0,
            result: "ok",
          })
          return {
            status: "business_outcome",
            capabilityId,
            outcome: outcome.code,
            detail: outcome.detail,
            stepsExecuted,
            durationMs: durationMs(),
          }
        }
        // Not a declared outcome — the run is STUCK. On a live session,
        // escalate: raise an intervention and wait for a human to take over
        // the SAME page and hand control back. A resumed run re-drives the
        // failed step against the human-adjusted page.
        if (options.session && options.handoff && !handoffUsed.has(i)) {
          handoffUsed.add(i)
          const observed =
            lastError instanceof Error ? lastError.message : String(lastError)
          evidence.logStep({
            runId: options.runId,
            stepIndex: i,
            at: new Date().toISOString(),
            action: "handoff",
            target: page.url(),
            reason: `step ${i} stuck (${observed}) — escalated to a human operator; run paused until control is returned`,
            durationMs: 0,
            result: "ok",
          })
          const resume = await options.handoff.onStuck({
            stepIndex: i,
            intent: step.intent,
            expected: step.intent,
            observed,
          })
          if (resume) {
            i-- // re-drive the failed step against the human-adjusted page
            continue
          }
          evidence.logStep({
            runId: options.runId,
            stepIndex: i,
            at: new Date().toISOString(),
            action: "handoff",
            reason: "operator did not resume in time — failing the run",
            durationMs: 0,
            result: "failed",
          })
        }
        return await fail(
          i,
          step.intent,
          lastError instanceof Error ? lastError.message : String(lastError)
        )
      }
    }

    const finalCheck = await checkCheckpoint(page, artifact.checkpoint)
    if (!finalCheck.ok) {
      return await fail(
        artifact.steps.length,
        "final checkpoint: " + describeCheckpoint(artifact.checkpoint),
        finalCheck.detail
      )
    }

    return {
      status: "success",
      capabilityId,
      outputs,
      stepsExecuted,
      durationMs: durationMs(),
    }
  } catch (err) {
    if (err instanceof BusinessOutcomeInterrupt) {
      return {
        status: "business_outcome",
        capabilityId,
        outcome: err.outcome.code,
        detail: err.outcome.detail,
        stepsExecuted,
        durationMs: durationMs(),
      }
    }
    throw err
  } finally {
    // The live session's context is owned by the session registry (the
    // operator may still be looking at it); only CLI-owned contexts close here.
    if (!options.session) await context.close().catch(() => undefined)
  }
}

const describeCheckpoint = (c: Checkpoint): string =>
  [
    c.urlPattern ? `url ~ /${c.urlPattern}/` : undefined,
    c.visibleText ? `text "${c.visibleText}"` : undefined,
    c.elementPresent
      ? `element ${describeLocator(c.elementPresent.primary)}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" AND ")
