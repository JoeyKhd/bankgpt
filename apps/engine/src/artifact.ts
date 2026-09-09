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
 */
export const LocatorSchema = z.object({
  strategy: z.enum(["a11y", "css", "text"]),
  role: z.string().optional().describe("ARIA role, for strategy a11y"),
  name: z
    .string()
    .optional()
    .describe("Accessible name as observed by the discovery run, for a11y"),
  exact: z
    .boolean()
    .default(true)
    .describe("Match the accessible name exactly (case-sensitive)"),
  css: z.string().optional().describe("CSS selector, for strategy css"),
  text: z
    .string()
    .optional()
    .describe("Visible text to match, for strategy text"),
})
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
export const CapabilityStepSchema = z.object({
  /** Short imperative summary for reviewers, e.g. "Type the member ID". */
  intent: z.string(),
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
export const CapabilityArtifactSchema = z.object({
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
export type CapabilityArtifact = z.infer<typeof CapabilityArtifactSchema>

/** Parse + validate an artifact from unknown data (e.g. JSON from disk). */
export const parseCapabilityArtifact = (data: unknown): CapabilityArtifact =>
  CapabilityArtifactSchema.parse(data)
