/**
 * Goal-driven discovery (assignment §3.1): the genuine LLM
 * observe → decide → act loop against a live Chromium surface.
 *
 * Each iteration:
 *  1. OBSERVE — the page's accessibility-tree YAML (`page.ariaSnapshot()`)
 *     plus a screenshot for situational awareness.
 *  2. DECIDE — one structured model call (AI SDK `generateText` +
 *     `Output.object`) returning the next action from a FIXED vocabulary,
 *     or `done` / `stuck` with a reason.
 *  3. ACT — execute via Playwright with `getByRole` semantics, capture the
 *     locators the model named (a11y primary + css/text fallbacks) so the
 *     distiller can bind every step to a robust target.
 *
 * Stop conditions: the model reports the goal met (`done`), reports a dead
 * end (`stuck`), or a limit fires (max steps / wall-clock timeout). Every
 * model message and every executed step is persisted to the run evidence —
 * the full transcript is what makes this run verifiable as GENUINE.
 *
 * On success the transcript is distilled into a capability artifact by a
 * final structured model call (inputs inferred from the values the model
 * typed, checkpoint proposed by the model, risk class proposed and left
 * `reviewed: false`).
 */
import { generateText, Output, type LanguageModel, type ModelMessage } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { z } from "zod"
import { chromium, type Browser, type Page } from "playwright"
import {
  CapabilityArtifactSchema,
  type CapabilityArtifact,
} from "./artifact.js"
import type { DiscoveryResult } from "./results.js"
import {
  assertUrlAllowed,
  assertActionAllowed,
  PolicyViolationError,
  type Policy,
} from "./policy.js"
import type { EvidenceWriter } from "./evidence.js"

// ---------------------------------------------------------------------------
// The action vocabulary the model may choose from (mirrors artifact steps,
// plus the two loop-control signals).
// ---------------------------------------------------------------------------

const DECISION_ACTIONS = [
  "navigate",
  "click",
  "type",
  "select",
  "press",
  "wait",
  "extract",
  "done",
  "stuck",
] as const

const DecisionSchema = z.object({
  reasoning: z
    .string()
    .describe("What you observe and why this is the right next action"),
  action: z.enum(DECISION_ACTIONS),
  /** For click/type/select/extract: the element's ARIA role, e.g. "textbox". */
  role: z.string().optional(),
  /** The element's exact accessible name as shown in the aria snapshot. */
  name: z.string().optional(),
  /** For navigate: the absolute URL. */
  url: z.string().optional(),
  /** For type: the literal text to type. For select: the option label. */
  value: z.string().optional(),
  /** For press: the key, e.g. "Enter". */
  key: z.string().optional(),
  /** For wait: text expected to become visible. */
  waitForText: z.string().optional(),
  /** For extract: a short note of what data you read (kept in the transcript). */
  extractNote: z.string().optional(),
  /** For done/stuck: why. */
  reason: z.string().optional(),
})
type Decision = z.infer<typeof DecisionSchema>

const SYSTEM_PROMPT = `You are a UI automation agent completing a goal in a live web application.

You observe the page through its ACCESSIBILITY TREE (YAML: role, name, state) and a SCREENSHOT, then choose exactly ONE next action.

Rules:
- Prefer accessibility roles + accessible names EXACTLY as they appear in the aria snapshot (e.g. role "textbox", name "Member ID").
- Work step by step. One action per turn. After an action you get a fresh observation.
- Use "done" ONLY when the goal is visibly and completely achieved on screen.
- Use "stuck" when you cannot make progress (blocked, missing element, repeated failure).
- Stay on the target application. Never navigate to an external site.
- Do not invent credentials or personal data; use only what the goal provides.
- For "type", put the exact text in "value". For "press", put the key name (e.g. "Enter") in "key".
- Keep "reasoning" to one or two sentences.`

const DISTILL_SYSTEM_PROMPT = `You convert a successful UI-automation transcript into a reusable capability artifact (JSON).

Rules:
- Inputs: every value the agent typed or chose that a caller would supply per invocation (e.g. a member ID) becomes a typed input; step "value" fields reference them as {{inputName}} placeholders.
- Outputs: data the agent read off the result page becomes typed outputs, each produced by an "extract" step.
- Targets: for each click/type/select/extract step keep the a11y role+name as primary; add css/text fallbacks and a robustness note.
- Checkpoint: propose a machine-checkable success condition (urlPattern and/or visibleText) that holds when the goal is achieved.
- Business outcomes: expected non-error states (e.g. "member not found") with detect rules (urlPattern/visibleText).
- Risk: "safe" for read-only flows; "risky" if the flow creates/changes/frees anything.
- The artifact must be self-contained and replayable WITHOUT a model.`

/** Zod schema for the distillation call — the artifact minus stamped fields. */
const DistilledArtifactSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string(),
  description: z.string(),
  risk: z.enum(["safe", "risky"]),
  inputs: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["string", "number", "boolean", "enum"]),
      required: z.boolean(),
      description: z.string(),
      values: z.array(z.string()).optional(),
    })
  ),
  outputs: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["string", "number", "boolean", "date"]),
      description: z.string(),
    })
  ),
  steps: z.array(
    z.object({
      intent: z.string(),
      action: z.enum([
        "navigate",
        "click",
        "type",
        "select",
        "press",
        "wait",
        "extract",
      ]),
      target: z
        .object({
          primary: z.object({
            role: z.string(),
            name: z.string(),
            exact: z.boolean().default(true),
          }),
          fallbacks: z
            .object({ css: z.string().optional(), text: z.string().optional() })
            .optional(),
          robustness: z.string(),
        })
        .optional(),
      input: z.string().optional(),
      value: z.string().optional(),
      url: z.string().optional(),
      key: z.string().optional(),
      outputName: z.string().optional(),
      extractKind: z.enum(["text", "value", "page-text-match"]).optional(),
      pattern: z.string().optional(),
    })
  ),
  checkpoint: z.object({
    urlPattern: z.string().optional(),
    visibleText: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
  }),
  businessOutcomes: z
    .array(
      z.object({
        code: z.string(),
        description: z.string(),
        detect: z.object({
          urlPattern: z.string().optional(),
          visibleText: z.string().optional(),
        }),
      })
    )
    .default([]),
})

/** One executed discovery step, kept for distillation + the transcript. */
type ExecutedStep = {
  index: number
  decision: Decision
  /** Locators observed for the acted-on element. */
  observed: {
    cssPath?: string
    visibleText?: string
  }
  outcome: string
  urlAfter: string
}

export type DiscoveryOptions = {
  goal: string
  targetUrl: string
  policy: Policy
  evidence: EvidenceWriter
  runId: string
  /** OpenRouter model id; must support vision + structured output. */
  model: string
  apiKey: string
  browser?: Browser
  /** Called with the distilled artifact when distillation succeeds. */
  onArtifact?: (artifact: CapabilityArtifact) => void
}

const MAX_ARIA_CHARS = 6000

/** Best-effort CSS path for an element handle (fallback-locator evidence). */
const cssPathFor = async (
  page: Page,
  role: string,
  name: string
): Promise<string | undefined> => {
  try {
    const el = await page
      .getByRole(role as never, { name, exact: true })
      .first()
      .elementHandle({ timeout: 2_000 })
    if (!el) return undefined
    return await page.evaluate((node: unknown) => {
      type El = {
        tagName: string
        id: string
        getAttribute: (n: string) => string | null
        parentElement: El | null
      }
      const parts: string[] = []
      let cur: El | null = node as El
      while (cur && cur.tagName.toLowerCase() !== "html" && parts.length < 6) {
        const tag = cur.tagName.toLowerCase()
        const id = cur.id ? `#${cur.id}` : ""
        const cls = (cur.getAttribute("class") ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((c: string) => `.${c}`)
          .join("")
        parts.unshift(`${tag}${id}${cls}`)
        cur = cur.parentElement
      }
      return parts.join(" > ")
    }, el)
  } catch {
    return undefined
  }
}

/** Observe the page: redacted aria snapshot (truncated) + screenshot bytes. */
const observe = async (page: Page) => {
  const rawAria = await page.ariaSnapshot().catch(() => "(no aria snapshot)")
  const aria =
    rawAria.length > MAX_ARIA_CHARS
      ? rawAria.slice(0, MAX_ARIA_CHARS) + "\n... (truncated)"
      : rawAria
  const screenshot = await page.screenshot({ fullPage: false })
  return { aria, screenshot, url: page.url() }
}

/** Execute one model-chosen action and return a short outcome note. */
const act = async (page: Page, decision: Decision): Promise<string> => {
  const byRole = () =>
    page.getByRole(decision.role as never, {
      name: decision.name ?? "",
      exact: true,
    })
  switch (decision.action) {
    case "navigate": {
      if (!decision.url) throw new Error("navigate needs url")
      await page.goto(decision.url, { waitUntil: "domcontentloaded" })
      return `navigated to ${decision.url}`
    }
    case "click": {
      await byRole().first().click()
      return `clicked ${decision.role} "${decision.name}"`
    }
    case "type": {
      await byRole()
        .first()
        .fill(decision.value ?? "")
      return `typed into ${decision.role} "${decision.name}"`
    }
    case "select": {
      await byRole()
        .first()
        .selectOption({ label: decision.value ?? "" })
      return `selected "${decision.value}"`
    }
    case "press": {
      if (decision.role && decision.name) {
        await byRole()
          .first()
          .press(decision.key ?? "Enter")
      } else {
        await page.keyboard.press(decision.key ?? "Enter")
      }
      return `pressed ${decision.key}`
    }
    case "wait": {
      if (decision.waitForText) {
        await page
          .getByText(decision.waitForText, { exact: false })
          .first()
          .waitFor({ state: "visible", timeout: 10_000 })
        return `waited for "${decision.waitForText}"`
      }
      await page.waitForTimeout(1_500)
      return "waited"
    }
    case "extract":
      return decision.extractNote ?? "noted page data"
    case "done":
    case "stuck":
      return decision.reason ?? decision.action
  }
}

/** Run the discovery loop. Returns the structured discovery result. */
export const runDiscovery = async (
  options: DiscoveryOptions
): Promise<DiscoveryResult> => {
  const startedAt = Date.now()
  const { policy, evidence, runId } = options
  const durationMs = () => Date.now() - startedAt

  assertUrlAllowed(policy, options.targetUrl)

  const openrouter = createOpenRouter({ apiKey: options.apiKey })
  const model = openrouter(options.model)

  const ownBrowser = options.browser === undefined
  const browser = options.browser ?? (await chromium.launch({ headless: true }))
  const context = await browser.newContext()
  const page = await context.newPage()

  const transcript: ModelMessage[] = []
  const executed: ExecutedStep[] = []

  try {
    await page.goto(options.targetUrl, { waitUntil: "domcontentloaded" })

    let observation = await observe(page)
    let finalStatus: DiscoveryResult["status"] = "stopped"
    let stopReason = `hit max steps (${policy.maxDiscoverySteps})`
    let stepIndex = 0

    for (stepIndex = 0; stepIndex < policy.maxDiscoverySteps; stepIndex++) {
      if (durationMs() > policy.discoveryTimeoutMs) {
        stopReason = `hit timeout (${policy.discoveryTimeoutMs}ms)`
        break
      }

      const userContent: ModelMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: `GOAL: ${options.goal}\n\nCurrent URL: ${observation.url}\n\nACCESSIBILITY TREE:\n${observation.aria}\n\nChoose the next action.`,
          },
          { type: "image", image: observation.screenshot },
        ],
      }
      transcript.push(userContent)

      const stepStart = Date.now()
      let decision: Decision
      try {
        const { output } = await generateText({
          model,
          output: Output.object({ schema: DecisionSchema }),
          instructions: SYSTEM_PROMPT,
          messages: transcript,
        })
        decision = output
      } catch (err) {
        evidence.logStep({
          runId,
          stepIndex,
          at: new Date(stepStart).toISOString(),
          action: "model-call",
          reason: "structured decision call failed",
          durationMs: Date.now() - stepStart,
          result: "failed",
          error: String(err),
        })
        stopReason = `model call failed: ${err instanceof Error ? err.message : String(err)}`
        break
      }

      transcript.push({
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify(decision) }],
      })

      let outcomeNote = ""
      try {
        assertActionAllowed(policy, decision.action)
        outcomeNote = await act(page, decision)
      } catch (err) {
        outcomeNote = `ACTION FAILED: ${err instanceof Error ? err.message : String(err)}`
        // A policy violation must stop the run — the agent tried to leave scope.
        if (err instanceof PolicyViolationError) {
          evidence.logStep({
            runId,
            stepIndex,
            at: new Date(stepStart).toISOString(),
            action: decision.action,
            reason: decision.reasoning,
            durationMs: Date.now() - stepStart,
            result: "failed",
            error: outcomeNote,
          })
          stopReason = outcomeNote
          finalStatus = "stopped"
          break
        }
      }

      // Record fallback-locator evidence for the acted-on element.
      const observed: ExecutedStep["observed"] = {}
      if (
        decision.role &&
        decision.name &&
        ["click", "type", "select", "extract"].includes(decision.action)
      ) {
        observed.cssPath = await cssPathFor(page, decision.role, decision.name)
      }

      executed.push({
        index: stepIndex,
        decision,
        observed,
        outcome: outcomeNote,
        urlAfter: page.url(),
      })

      evidence.logStep({
        runId,
        stepIndex,
        at: new Date(stepStart).toISOString(),
        action: decision.action,
        target:
          decision.role && decision.name
            ? `${decision.role}[name=${JSON.stringify(decision.name)}]`
            : decision.url,
        reason: decision.reasoning,
        durationMs: Date.now() - stepStart,
        result: outcomeNote.startsWith("ACTION FAILED") ? "failed" : "ok",
        error: outcomeNote.startsWith("ACTION FAILED")
          ? outcomeNote
          : undefined,
      })

      if (decision.action === "done") {
        finalStatus = "success"
        stopReason = decision.reason ?? "goal met"
        break
      }
      if (decision.action === "stuck") {
        finalStatus = "stuck"
        stopReason = decision.reason ?? "model reported stuck"
        break
      }

      // Feed the post-action observation into the next turn.
      transcript.push({
        role: "user",
        content: [{ type: "text", text: `ACTION RESULT: ${outcomeNote}` }],
      })
      observation = await observe(page)
    }

    evidence.writeTranscript(transcript)

    if (finalStatus === "success") {
      const capabilityId = await distillArtifact(
        options,
        model,
        executed,
        runId
      )
      return {
        status: "success",
        goal: options.goal,
        stepsExecuted: executed.length,
        durationMs: durationMs(),
        capabilityId,
      }
    }
    if (finalStatus === "stuck") {
      return {
        status: "stuck",
        goal: options.goal,
        reason: stopReason,
        step: executed.length,
        durationMs: durationMs(),
      }
    }
    return {
      status: "stopped",
      goal: options.goal,
      reason: stopReason,
      stepsExecuted: executed.length,
      durationMs: durationMs(),
    }
  } finally {
    await context.close().catch(() => undefined)
    if (ownBrowser) await browser.close().catch(() => undefined)
  }
}

/**
 * Distill a successful transcript into a validated capability artifact via
 * one structured model call. Returns the artifact id.
 */
const distillArtifact = async (
  options: DiscoveryOptions,
  model: LanguageModel,
  executed: ExecutedStep[],
  runId: string
): Promise<string | undefined> => {
  const stepsSummary = executed.map((s) => ({
    index: s.index,
    action: s.decision.action,
    role: s.decision.role,
    name: s.decision.name,
    value: s.decision.value,
    url: s.decision.url,
    key: s.decision.key,
    outcome: s.outcome,
    urlAfter: s.urlAfter,
    cssPath: s.observed.cssPath,
  }))

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: DistilledArtifactSchema }),
      instructions: DISTILL_SYSTEM_PROMPT,
      prompt: `GOAL: ${options.goal}\nTARGET APP URL: ${options.targetUrl}\n\nEXECUTED STEPS (JSON):\n${JSON.stringify(stepsSummary, null, 2)}\n\nProduce the capability artifact. The capability id must be a short snake_case name for the goal.`,
    })

    const artifact: CapabilityArtifact = CapabilityArtifactSchema.parse({
      ...output,
      version: "1.0.0",
      goal: options.goal,
      targetApp: options.targetUrl,
      createdAt: new Date().toISOString(),
      discoveryModel: options.model,
      discoveryRunId: runId,
      reviewed: false,
      businessOutcomes: output.businessOutcomes ?? [],
    })

    options.onArtifact?.(artifact)
    return artifact.id
  } catch {
    // Distillation failure must not mask a genuine successful discovery.
    return undefined
  }
}
