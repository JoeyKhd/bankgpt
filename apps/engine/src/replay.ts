/**
 * Deterministic replay (assignment §3.3): the production execution path.
 *
 * Given a saved capability artifact and typed input parameters, replay
 * executes the recorded steps WITHOUT any model calls:
 *
 * - targets resolve by primary a11y locator (role + accessible name), then
 *   fall back through the recorded candidates IN RECORDED ORDER (never a
 *   DOM-ordered locator union), with explicit waits — never pixel
 *   coordinates;
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
  type CapabilityOutput,
  type CapabilityStep,
  type Target,
  type Locator as RecordedLocator,
  type Checkpoint,
} from "@/artifact"
import type { RunResult } from "@/results"
import {
  assertUrlAllowed,
  assertActionAllowed,
  requireApproval,
  ApprovalRequiredError,
  type Policy,
} from "@/policy"
import { attachDialogHandler } from "@/dialogs"
import type { EvidenceWriter } from "@/evidence"
import { waitWhileNotAutomation, type LiveSession } from "@/session"

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

/**
 * Coerce one extracted value into its declared output type. Extract steps
 * read strings off the page (element text, input values, regex captures);
 * the DECLARED output contract decides the caller-facing type. A value
 * that cannot honestly convert (e.g. "n/a" into a number) throws — the
 * step fails and becomes the structured result, instead of silently
 * returning a mistyped output to the calling agent.
 */
const coerceOutputValue = (
  spec: CapabilityOutput,
  value: string | number | boolean
): string | number | boolean => {
  switch (spec.type) {
    case "string":
      return typeof value === "string" ? value : String(value)
    case "number": {
      const n = typeof value === "number" ? value : Number(value)
      if (typeof value !== "number" && Number.isNaN(n)) {
        throw new Error(
          `output "${spec.name}" is declared number but extracted ${JSON.stringify(value)}`
        )
      }
      return n
    }
    case "boolean": {
      if (typeof value === "boolean") return value
      const v = String(value).trim().toLowerCase()
      if (v === "true" || v === "yes" || v === "1") return true
      if (v === "false" || v === "no" || v === "0") return false
      throw new Error(
        `output "${spec.name}" is declared boolean but extracted ${JSON.stringify(value)}`
      )
    }
    case "date": {
      // Dates cross the wire as ISO strings; reject values that do not
      // parse so the caller never receives a garbage "date".
      const s = String(value)
      if (Number.isNaN(Date.parse(s))) {
        throw new Error(
          `output "${spec.name}" is declared date but extracted ${JSON.stringify(value)}`
        )
      }
      return s
    }
  }
}

/**
 * Validate the extracted outputs against the declared output contract
 * before reporting success: every declared output must be present and
 * type-coerced, and nothing undeclared may leak into the result.
 */
const validateOutputs = (
  artifact: CapabilityArtifact,
  raw: Record<string, string | number | boolean>
): Record<string, string | number | boolean> => {
  const declared = new Map(artifact.outputs.map((o) => [o.name, o]))
  for (const name of Object.keys(raw)) {
    if (!declared.has(name)) {
      throw new Error(
        `replay produced undeclared output "${name}" (not in the artifact's output contract)`
      )
    }
  }
  const clean: Record<string, string | number | boolean> = {}
  for (const spec of artifact.outputs) {
    const value = raw[spec.name]
    if (value === undefined) {
      throw new Error(
        `replay finished without producing declared output "${spec.name}" (no extract step filled it)`
      )
    }
    clean[spec.name] = coerceOutputValue(spec, value)
  }
  return clean
}

/** Build a Playwright locator for one recorded locator candidate. */
const toLocator = (page: Page, candidate: RecordedLocator): Locator => {
  switch (candidate.strategy) {
    case "a11y":
      return page.getByRole(candidate.role as never, {
        name: candidate.name,
        exact: candidate.exact,
      })
    case "css":
      return page.locator(candidate.css)
    case "text":
      return page.getByText(candidate.text, { exact: candidate.exact ?? false })
  }
}

/** Short human-readable description of a locator, for logs and errors. */
const describeLocator = (candidate: RecordedLocator): string => {
  switch (candidate.strategy) {
    case "a11y":
      return `${candidate.role}[name=${JSON.stringify(candidate.name)}]`
    case "css":
      return `css(${candidate.css})`
    case "text":
      return `text(${JSON.stringify(candidate.text)})`
  }
}

/** Per-candidate probe timeout for the ordered fallback chain. */
const FALLBACK_PROBE_MS = 2_000

/**
 * Run `act` against the FIRST locator candidate that currently matches:
 * the primary first, then the recorded fallbacks IN RECORDED ORDER.
 *
 * This is deliberately NOT Playwright's `locator.or(...).first()` union:
 * the OR locator merges matches in DOCUMENT order, so a visible fallback
 * element sitting higher in the DOM would silently win over the primary
 * a11y identity — the exact drift the fallback order is supposed to
 * absorb. Here a candidate is used only when it resolves to at least one
 * attached element within a short probe window; otherwise the next
 * recorded candidate is tried. `act` still gets Playwright's own
 * actionability waits and auto-retry against the chosen candidate.
 */
const withResolvedTarget = async <T>(
  page: Page,
  target: Target,
  act: (locator: Locator) => Promise<T>
): Promise<T> => {
  const candidates = [target.primary, ...target.fallbacks]
  for (const candidate of candidates) {
    const locator = toLocator(page, candidate).first()
    try {
      await locator.waitFor({ state: "attached", timeout: FALLBACK_PROBE_MS })
      return await act(locator)
    } catch (err) {
      // The action itself (click/fill/extract) failing on a RESOLVED
      // element is not a locator miss: the element was there and the
      // action failed for real — report it instead of masking it behind
      // the remaining fallbacks.
      const matched = (await locator.count().catch(() => 0)) > 0
      if (matched) throw err
    }
  }
  throw new Error(
    `target not found; tried in order: ${candidates.map(describeLocator).join(" → ")}`
  )
}

/** Assert one checkpoint condition set against the live page. */
const checkCheckpoint = async (
  page: Page,
  checkpoint: Checkpoint,
  inputs: ReplayInputs = {}
): Promise<{ ok: boolean; detail: string }> => {
  const timeout = checkpoint.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (checkpoint.urlPattern) {
    // Checkpoints are part of the parameterized contract: {{input}}
    // placeholders must substitute exactly like step urls/values, or a
    // parameterized checkpoint can never hold.
    const pattern = substitute(checkpoint.urlPattern, inputs)
    try {
      await page.waitForURL(new RegExp(pattern), { timeout })
    } catch {
      return {
        ok: false,
        detail: `URL ${page.url()} did not match /${pattern}/ within ${timeout}ms`,
      }
    }
  }
  if (checkpoint.visibleText) {
    const wanted = substitute(checkpoint.visibleText, inputs)
    try {
      await page
        .getByText(wanted, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout })
    } catch {
      return {
        ok: false,
        detail: `visible text "${wanted}" not found within ${timeout}ms`,
      }
    }
  }
  if (checkpoint.elementPresent) {
    try {
      await withResolvedTarget(page, checkpoint.elementPresent, (l) =>
        l.waitFor({ state: "attached", timeout })
      )
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
  suppress: string[] = [],
  inputs: ReplayInputs = {}
): Promise<{ code: string; detail: string } | undefined> => {
  for (const outcome of artifact.businessOutcomes) {
    if (suppress.includes(outcome.code)) continue
    // Detect rules are part of the parameterized contract too — substitute
    // {{input}} exactly like checkpoints (D-053), or a member-scoped detect
    // rule can never match.
    const detectUrl = outcome.detect.urlPattern
      ? substitute(outcome.detect.urlPattern, inputs)
      : undefined
    const urlOk = detectUrl ? new RegExp(detectUrl).test(page.url()) : true
    let textOk = true
    if (outcome.detect.visibleText) {
      const detectText = substitute(outcome.detect.visibleText, inputs)
      textOk = (await page.getByText(detectText, { exact: false }).count()) > 0
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
      await withResolvedTarget(page, step.target, (l) => l.click())
      return `clicked ${describeLocator(step.target.primary)}`
    }
    case "type": {
      if (!step.target) throw new Error("type step needs a target")
      const value = step.value ? substitute(step.value, inputs) : ""
      // A consumed input's value is already echoed in the re-rendered field;
      // filling again would retype the same value. Skip the fill.
      if (step.input && consumedInputs.has(step.input)) {
        return `skipped retype of consumed input "${step.input}" in ${describeLocator(step.target.primary)}`
      }
      await withResolvedTarget(page, step.target, (l) => l.fill(value))
      if (step.input) consumedInputs.add(step.input)
      return `typed into ${describeLocator(step.target.primary)}`
    }
    case "select": {
      if (!step.target) throw new Error("select step needs a target")
      const value = step.value ? substitute(step.value, inputs) : ""
      await withResolvedTarget(page, step.target, (l) =>
        l.selectOption({ label: value })
      )
      return `selected "${value}" in ${describeLocator(step.target.primary)}`
    }
    case "press": {
      if (!step.key) throw new Error("press step needs a key")
      if (step.target) {
        const key = step.key
        await withResolvedTarget(page, step.target, (l) => l.press(key))
      } else {
        await page.keyboard.press(step.key)
      }
      return `pressed ${step.key}`
    }
    case "wait": {
      if (!step.checkpoint) throw new Error("wait step needs a checkpoint")
      const res = await checkCheckpoint(page, step.checkpoint, inputs)
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
      const text = await withResolvedTarget(page, step.target, (l) =>
        l.innerText()
      )
      return text.trim()
    }
    case "value": {
      if (!step.target) throw new Error("extract(value) needs a target")
      return await withResolvedTarget(page, step.target, (l) => l.inputValue())
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
  // Review is an INDEPENDENT gate, not an approval substitute: an
  // unreviewed risky artifact never executes, token or not — approval
  // authorizes one run of a REVIEWED artifact, it cannot stand in for the
  // human review pass itself.
  if (
    policy.requireReviewForRisky &&
    artifact.risk === "risky" &&
    !artifact.reviewed
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
  let lastMainMethod: string | undefined
  page.on("response", (response) => {
    if (
      response.request().isNavigationRequest() &&
      response.frame() === page.mainFrame()
    ) {
      lastMainStatus = response.status()
      lastMainMethod = response.request().method()
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
        if (options.session) {
          const epochBefore = options.session.epoch
          await waitWhileNotAutomation(options.session)
          // Ownership may have changed while we waited — if so, abort this
          // action attempt and re-evaluate from the new owner.
          if (options.session.epoch !== epochBefore) {
            throw new Error("ownership changed during wait — aborting action")
          }
        }
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
            if (lastMainMethod === "GET") {
              await page.reload({ waitUntil: "domcontentloaded" })
            } else {
              // A POST that returned 5xx may have committed server-side;
              // reloading would repeat the mutation. Escalate instead.
              throw new TransientServerError(lastMainStatus)
            }
          }

          // The page may have moved; re-assert scope before acting.
          if (page.url() !== "about:blank") {
            assertUrlAllowed(policy, page.url())
          }
          if (step.action === "extract") {
            const value = await executeExtract(page, step)
            if (step.outputName) {
              const spec = artifact.outputs.find(
                (o) => o.name === step.outputName
              )
              if (!spec) {
                throw new Error(
                  `extract step fills undeclared output "${step.outputName}"`
                )
              }
              const coerced = coerceOutputValue(spec, value)
              outputs[step.outputName] = coerced
              detail = `extracted ${step.outputName}=${JSON.stringify(coerced)}`
            } else {
              detail = "extract (no outputName)"
            }
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
            const early = await detectBusinessOutcome(
              page,
              artifact,
              [],
              inputs
            )
            if (early) throw new BusinessOutcomeInterrupt(early)
            const res = await checkCheckpoint(page, step.checkpoint, inputs)
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
          step.suppressOutcomes ?? [],
          inputs
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
        const outcome = await detectBusinessOutcome(page, artifact, [], inputs)
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

    const finalCheck = await checkCheckpoint(page, artifact.checkpoint, inputs)
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
      outputs: validateOutputs(artifact, outputs),
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
