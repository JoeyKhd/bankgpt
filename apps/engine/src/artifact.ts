/**
 * The capability artifact: the contract at the center of the system.
 *
 * A capability artifact is the typed, serializable, versioned record of one
 * successful LLM discovery run, distilled into a flow that can be replayed
 * deterministically (zero model calls) with typed inputs. It is written for
 * two audiences at once:
 *
 * - a HUMAN REVIEWER, who must be able to read the artifact and understand
 *   what the capability does, what it needs, what it returns, and how
 *   confident we are in each recorded step (see `Target.robustness`), and
 * - a CALLING AGENT, which treats it as an invocable function: supply
 *   `inputs`, receive `outputs` (or a structured non-success result).
 *
 * Design rules:
 * - All validation lives here as zod schemas; every TypeScript type is
 *   derived with `z.infer` — there are no hand-written parallel interfaces.
 * - Steps bind to SEMANTIC locators (accessibility role + accessible name)
 *   with recorded fallbacks. Pixel coordinates are never recorded: they do
 *   not survive restyling, and restyling is the common case across tenants
 *   that share a vendor product.
 * - The artifact is self-describing. No code on the replay path is
 *   capability-specific; the replay engine interprets this schema only.
 */
import { z } from "zod"

/**
 * Semver-ish artifact version. Discovery always stamps "1.0.0"; reviewers
 * bump the version when they edit a reviewed artifact.
 */
export const ArtifactVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "version must look like 1.2.3")

/** Risk classification (assignment §3.4). */
export const RiskClassSchema = z.enum(["safe", "risky"])
export type RiskClass = z.infer<typeof RiskClassSchema>

/**
 * Typed input parameter the calling agent supplies per invocation.
 * `enum` inputs must enumerate their allowed values.
 */
export const CapabilityInputSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, "input names are lowerCamelCase"),
  type: z.enum(["string", "number", "boolean", "enum"]),
  required: z.boolean(),
  description: z.string(),
  /** Allowed values when `type` is "enum". */
  values: z.array(z.string()).optional(),
})
export type CapabilityInput = z.infer<typeof CapabilityInputSchema>

/** Typed output the replay extracts and returns to the caller. */
export const CapabilityOutputSchema = z.object({
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  type: z.enum(["string", "number", "boolean", "date"]),
  description: z.string(),
})
export type CapabilityOutput = z.infer<typeof CapabilityOutputSchema>

/**
 * One locator candidate for an element, with the strategy that produced it.
 * `a11y` (role + accessible name) is the preferred strategy — it survives
 * CSS restyling, theming, and markup churn, which is exactly the drift we
 * expect across tenants that share a vendor product.
 *
 * The schema is a STRICT discriminated union on `strategy`: each variant
 * requires its own nonempty fields and rejects every other key. The earlier
 * all-optional object accepted structurally useless locators (an a11y
 * locator without a name resolved to "first element with this role
 * anywhere") and silently carried legacy mistakes like
 * `{strategy: "text", value: "…"}` (a probe artifact once shipped exactly
 * that — the `value` key is not a locator field and never matched).
 */
export const LocatorSchema = z.discriminatedUnion("strategy", [
  z
    .object({
      strategy: z.literal("a11y"),
      role: z.string().min(1).describe("ARIA role"),
      name: z
        .string()
        .min(1)
        .describe("Accessible name as observed by the discovery run"),
      exact: z
        .boolean()
        .default(true)
        .describe("Match the accessible name exactly (case-sensitive)"),
    })
    .strict(),
  z
    .object({
      strategy: z.literal("css"),
      css: z.string().min(1).describe("CSS selector"),
      // Legacy artifacts (schema before the strict union) carried `exact`
      // on every variant. It is meaningless for CSS and ignored at replay;
      // accepted here so stored artifacts keep parsing. Truly foreign keys
      // (e.g. `value`) are still rejected.
      exact: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      strategy: z.literal("text"),
      text: z.string().min(1).describe("Visible text to match"),
      // Same legacy allowance as css; for text it is honored at replay
      // (exact vs substring match), defaulting to substring.
      exact: z.boolean().optional(),
    })
    .strict(),
])
export type Locator = z.infer<typeof LocatorSchema>

/**
 * How one element is found on the live surface.
 *
 * `primary` is the locator replay tries first — almost always the
 * accessibility-tree identity of the element. `fallbacks` records every
 * OTHER locator the discovery run observed for the same element, tried in
 * recorded order. `robustness` is a human-readable note (written by the
 * discovery model at distillation time) explaining WHY this target should
 * (or should not) survive UI drift.
 */
export const TargetSchema = z.object({
  primary: LocatorSchema,
  fallbacks: z.array(LocatorSchema).default([]),
  robustness: z
    .string()
    .describe("Why this target should survive UI drift (reviewer-facing)"),
})
export type Target = z.infer<typeof TargetSchema>

/** The fixed action vocabulary. Discovery cannot invent actions outside it. */
export const StepActionSchema = z.enum([
  "navigate",
  "click",
  "type",
  "select",
  "press",
  "wait",
  "extract",
])
export type StepAction = z.infer<typeof StepActionSchema>

/**
 * One ordered step of the recorded flow.
 *
 * - `navigate`: go to `url` (may contain `{{input}}` placeholders).
 * - `click` / `type` / `select`: act on `target`. `type` uses `value` as a
 *   literal or as `{{inputName}}` to substitute a typed input (then `input`
 *   names the parameter). `select` selects `value` (an option label or
 *   `{{inputName}}`).
 * - `press`: press a keyboard `key` (e.g. "Enter"), optionally on `target`.
 * - `wait`: wait for `checkpoint` to hold (used for slow loads).
 * - `extract`: read the page into an output. `outputName` declares which
 *   declared output this fills; `extractKind` says what to read:
 *   "text" (target's inner text), "value" (target's input value), or
 *   "page-text-match" (first regex capture from the visible page text,
 *   e.g. a confirmation number).
 */
/** Per-action required/allowed fields, enforced by the superRefine below. */
const STEP_FIELD_RULES: Record<
  StepAction,
  { required: string[]; allowed: string[] }
> = {
  navigate: {
    required: ["url"],
    allowed: ["intent", "action", "url", "checkpoint"],
  },
  click: {
    required: ["target"],
    allowed: ["intent", "action", "target", "checkpoint", "suppressOutcomes"],
  },
  type: {
    required: ["target"],
    allowed: [
      "intent",
      "action",
      "target",
      "input",
      "value",
      "checkpoint",
      "suppressOutcomes",
    ],
  },
  select: {
    required: ["target"],
    allowed: [
      "intent",
      "action",
      "target",
      "input",
      "value",
      "checkpoint",
      "suppressOutcomes",
    ],
  },
  press: {
    required: ["key"],
    allowed: [
      "intent",
      "action",
      "target",
      "key",
      "checkpoint",
      "suppressOutcomes",
    ],
  },
  wait: {
    required: ["checkpoint"],
    allowed: ["intent", "action", "checkpoint"],
  },
  extract: {
    required: ["outputName", "extractKind"],
    allowed: [
      "intent",
      "action",
      "target",
      "outputName",
      "extractKind",
      "pattern",
      "checkpoint",
      "suppressOutcomes",
    ],
  },
}

export const CapabilityStepSchema = z
  .object({
    /** Short imperative summary for reviewers, e.g. "Type the member ID". */
    intent: z.string().min(1),
    action: StepActionSchema,
    target: TargetSchema.optional(),
    /** Which typed input feeds this step (for `type` / `select` / navigate URL). */
    input: z.string().optional(),
    /** Literal value or `{{inputName}}` placeholder. */
    value: z.string().optional(),
    /** Destination URL for `navigate`; supports `{{inputName}}` placeholders. */
    url: z.string().optional(),
    /** Key name for `press`, e.g. "Enter". */
    key: z.string().optional(),
    /** For `extract`: which declared output this step fills. */
    outputName: z.string().optional(),
    extractKind: z.enum(["text", "value", "page-text-match"]).optional(),
    /** Regex with one capture group, for `page-text-match` extraction. */
    pattern: z.string().optional(),
    /** Optional per-step assertion checked right after the action. */
    checkpoint: z.lazy(() => CheckpointSchema).optional(),
    /**
     * Business-outcome codes that must NOT fire right after this step. Use when
     * an outcome's detect text also matches an intermediate page (e.g. a
     * validation error re-renders the same form): the step's own checkpoint
     * fails first and the step retry loop re-drives, while the outcome still
     * fires on later steps.
     */
    suppressOutcomes: z.array(z.string()).optional(),
  })
  .superRefine((step, ctx) => {
    // Action-specific required fields: the replay executor throws on these
    // at runtime; catching them at parse time keeps a malformed artifact
    // out of the store (a navigate without url, an extract that fills no
    // declared output, a wait with nothing to wait for).
    const rules = STEP_FIELD_RULES[step.action]
    for (const field of rules.required) {
      if (step[field as keyof typeof step] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${step.action} step requires "${field}"`,
        })
      }
    }
    if (step.action === "extract" && step.extractKind === "page-text-match") {
      if (!step.pattern) {
        ctx.addIssue({
          code: "custom",
          path: ["pattern"],
          message: "extract(page-text-match) requires a pattern",
        })
      } else if (!/\(/.test(step.pattern)) {
        ctx.addIssue({
          code: "custom",
          path: ["pattern"],
          message: "extract(page-text-match) pattern needs a capture group",
        })
      }
    }
    if (
      step.suppressOutcomes !== undefined &&
      step.action !== "click" &&
      step.action !== "type" &&
      step.action !== "select" &&
      step.action !== "press"
    ) {
      // suppressOutcomes only makes sense on steps that can re-render the
      // page into an outcome-detecting state; keep it off pure reads.
      if (step.action === "extract" || step.action === "wait") {
        ctx.addIssue({
          code: "custom",
          path: ["suppressOutcomes"],
          message: `suppressOutcomes is meaningless on a ${step.action} step`,
        })
      }
    }
  })
export type CapabilityStep = z.infer<typeof CapabilityStepSchema>

/**
 * Machine-checkable success condition. At least one field must be set.
 * All set fields must hold simultaneously.
 */
export const CheckpointSchema = z
  .object({
    /** Regex matched against the current URL. */
    urlPattern: z.string().optional(),
    /** Text that must be visible anywhere on the page. */
    visibleText: z.string().optional(),
    /** Element that must be present. */
    elementPresent: TargetSchema.optional(),
    /** Per-check timeout override in ms (default 10s). */
    timeoutMs: z.number().int().positive().optional(),
  })
  .refine(
    (c) =>
      c.urlPattern !== undefined ||
      c.visibleText !== undefined ||
      c.elementPresent !== undefined,
    { message: "checkpoint needs at least one condition" }
  )
export type Checkpoint = z.infer<typeof CheckpointSchema>

/**
 * A named EXPECTED business outcome — an answer, not a crash
 * (assignment §3.3). Example: `member_not_found`. Replay checks these rules
 * after each step; when one matches, the run ends with
 * `business_outcome(code, detail)` instead of failing.
 */
export const BusinessOutcomeSchema = z.object({
  /** Machine-readable code the caller branches on, e.g. "member_not_found". */
  code: z.string().regex(/^[a-z][a-z0-9_]*$/),
  description: z.string(),
  detect: z.object({
    urlPattern: z.string().optional(),
    visibleText: z.string().optional(),
  }),
})
export type BusinessOutcome = z.infer<typeof BusinessOutcomeSchema>

/** The full capability artifact. */
export const CapabilityArtifactSchema = z
  .object({
    /** Stable machine id, e.g. "lookup_member_balance". */
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    version: ArtifactVersionSchema,
    /** Human-readable capability name. */
    name: z.string(),
    /** One-paragraph description for reviewers and calling agents. */
    description: z.string(),
    /** The original natural-language goal discovery was given. */
    goal: z.string(),
    /** Proxy application the flow was discovered against, e.g. "FinCore Teller (proxy)". */
    targetApp: z.string(),
    risk: RiskClassSchema,
    /** ISO 8601 creation time of the discovery run. */
    createdAt: z.string(),
    /** Exact model id that performed discovery (auditability). */
    discoveryModel: z.string(),
    /** Id of the discovery run this artifact was distilled from. */
    discoveryRunId: z.string(),
    inputs: z.array(CapabilityInputSchema),
    outputs: z.array(CapabilityOutputSchema),
    steps: z.array(CapabilityStepSchema).min(1),
    /** Success condition asserted at the end of replay. */
    checkpoint: CheckpointSchema,
    /** Expected business outcomes with their detection rules. */
    businessOutcomes: z.array(BusinessOutcomeSchema).default([]),
    /**
     * Review state. Discovery sets `reviewed: false`; replay policy may
     * require review before risky capabilities execute without an approval.
     */
    reviewed: z.boolean().default(false),
  })
  .superRefine((artifact, ctx) => {
    // Cross-field contract checks: uniqueness of declared names and that
    // every step reference points at a DECLARED input/output. Without this
    // a typo like outputName "savingsBalanc" parsed fine and only surfaced
    // as a missing output after a full replay.
    const seenInputs = new Set<string>()
    artifact.inputs.forEach((input, i) => {
      if (seenInputs.has(input.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["inputs", i, "name"],
          message: `duplicate input name "${input.name}"`,
        })
      }
      seenInputs.add(input.name)
      if (
        input.type === "enum" &&
        (!input.values || input.values.length === 0)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["inputs", i, "values"],
          message: `enum input "${input.name}" must declare allowed values`,
        })
      }
    })
    const seenOutputs = new Set<string>()
    artifact.outputs.forEach((output, i) => {
      if (seenOutputs.has(output.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["outputs", i, "name"],
          message: `duplicate output name "${output.name}"`,
        })
      }
      seenOutputs.add(output.name)
    })
    const outcomeCodes = new Set<string>()
    artifact.businessOutcomes.forEach((outcome, i) => {
      if (outcomeCodes.has(outcome.code)) {
        ctx.addIssue({
          code: "custom",
          path: ["businessOutcomes", i, "code"],
          message: `duplicate business outcome code "${outcome.code}"`,
        })
      }
      outcomeCodes.add(outcome.code)
    })
    artifact.steps.forEach((step, i) => {
      if (step.input !== undefined && !seenInputs.has(step.input)) {
        ctx.addIssue({
          code: "custom",
          path: ["steps", i, "input"],
          message: `step ${i} references undeclared input "${step.input}"`,
        })
      }
      if (step.outputName !== undefined && !seenOutputs.has(step.outputName)) {
        ctx.addIssue({
          code: "custom",
          path: ["steps", i, "outputName"],
          message: `step ${i} extracts undeclared output "${step.outputName}"`,
        })
      }
      for (const code of step.suppressOutcomes ?? []) {
        if (!outcomeCodes.has(code)) {
          ctx.addIssue({
            code: "custom",
            path: ["steps", i, "suppressOutcomes"],
            message: `step ${i} suppresses undeclared business outcome "${code}"`,
          })
        }
      }
    })
  })
export type CapabilityArtifact = z.infer<typeof CapabilityArtifactSchema>

/** Parse + validate an artifact from unknown data (e.g. JSON from disk). */
export const parseCapabilityArtifact = (data: unknown): CapabilityArtifact =>
  CapabilityArtifactSchema.parse(data)
