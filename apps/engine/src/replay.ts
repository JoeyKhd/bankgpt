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
  type Policy,
} from "./policy.js"
import type { EvidenceWriter } from "./evidence.js"

/** Inputs as supplied by the caller (validated against the artifact). */
export type ReplayInputs = Record<string, string | number | boolean>

export type ReplayEvents = {
  /** Fired after each step resolves (ok or failed). */
  onStep?: (stepIndex: number, step: CapabilityStep, ok: boolean) => void
}

const DEFAULT_TIMEOUT_MS = 10_000
/** Transient conditions get this many attempts before we give up. */
const MAX_STEP_ATTEMPTS = 3

/** Substitute `{{inputName}}` placeholders using validated inputs. */
const substitute = (template: string, inputs: ReplayInputs): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => {
    if (!(name in inputs)) {
      throw new Error(`no value supplied for input "${name}"`)
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

/** Resolve a recorded target to a live locator: primary a11y first, then fallbacks. */
const resolveTarget = (page: Page, target: Target): Locator => {
  const candidates: Locator[] = [
    page.getByRole(target.primary.role as never, {
      name: target.primary.name,
      exact: target.primary.exact,
    }),
  ]
  if (target.fallbacks?.css) candidates.push(page.locator(target.fallbacks.css))
  if (target.fallbacks?.text) {
    candidates.push(page.getByText(target.fallbacks.text, { exact: false }))
  }
  // first() on the OR chain: Playwright resolves the first candidate that
  // matches, in order, when the locator is awaited.
  return candidates.reduce((acc, l) => acc.or(l))
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
        detail: `expected element (role "${checkpoint.elementPresent.primary.role}" named "${checkpoint.elementPresent.primary.name}") not present within ${timeout}ms`,
      }
    }
  }
  return { ok: true, detail: "checkpoint holds" }
}

/** Check whether any declared business outcome currently matches the page. */
const detectBusinessOutcome = async (
  page: Page,
  artifact: CapabilityArtifact
): Promise<{ code: string; detail: string } | undefined> => {
  for (const outcome of artifact.businessOutcomes) {
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
  inputs: ReplayInputs
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
      return `clicked ${step.target.primary.role} "${step.target.primary.name}"`
    }
    case "type": {
      if (!step.target) throw new Error("type step needs a target")
      const value = step.value ? substitute(step.value, inputs) : ""
      await resolveTarget(page, step.target).first().fill(value)
      return `typed into ${step.target.primary.role} "${step.target.primary.name}"`
    }
    case "select": {
      if (!step.target) throw new Error("select step needs a target")
      const value = step.value ? substitute(step.value, inputs) : ""
      await resolveTarget(page, step.target)
        .first()
        .selectOption({ label: value })
      return `selected "${value}" in "${step.target.primary.name}"`
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
      const match = body.match(new RegExp(step.pattern))
      if (!match || match[1] === undefined) {
        throw new Error(`pattern /${step.pattern}/ did not match page text`)
      }
      return match[1].trim()
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

  const context = await options.browser.newContext()
  const page = await context.newPage()
  const outputs: Record<string, string | number | boolean> = {}
  let stepsExecuted = 0

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
        try {
          // The page may have moved; re-assert scope before acting.
          if (page.url() !== "about:blank") {
            assertUrlAllowed(policy, page.url())
          }
          if (step.action === "extract") {
            const value = await executeExtract(page, step)
            if (step.outputName) outputs[step.outputName] = value
            detail = `extracted ${step.outputName}=${JSON.stringify(value)}`
          } else {
            detail = await executeStep(page, step, inputs)
          }
          if (step.checkpoint && step.action !== "wait") {
            const res = await checkCheckpoint(page, step.checkpoint)
            if (!res.ok)
              throw new Error(`step checkpoint failed: ${res.detail}`)
          }
          ok = true
          break
        } catch (err) {
          lastError = err
          // Only retry wait-like/transient failures, never policy violations.
          if (
            err instanceof Error &&
            (err.name === "PolicyViolationError" ||
              err.name === "ApprovalRequiredError")
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
        target: step.target
          ? `${step.target.primary.role}[name=${JSON.stringify(step.target.primary.name)}]`
          : step.url,
        reason: ok && detail ? `${step.intent} — ${detail}` : step.intent,
        durationMs: Date.now() - stepStart,
        result: ok ? "ok" : "failed",
        error: ok ? undefined : String(lastError),
      })
      options.events?.onStep?.(i, step, ok)

      if (!ok) {
        return await fail(
          i,
          step.intent,
          lastError instanceof Error ? lastError.message : String(lastError)
        )
      }

      // Expected business outcome? That is an ANSWER — stop cleanly.
      const outcome = await detectBusinessOutcome(page, artifact)
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
  } finally {
    await context.close().catch(() => undefined)
  }
}

const describeCheckpoint = (c: Checkpoint): string =>
  [
    c.urlPattern ? `url ~ /${c.urlPattern}/` : undefined,
    c.visibleText ? `text "${c.visibleText}"` : undefined,
    c.elementPresent ? `element "${c.elementPresent.primary.name}"` : undefined,
  ]
    .filter(Boolean)
    .join(" AND ")
