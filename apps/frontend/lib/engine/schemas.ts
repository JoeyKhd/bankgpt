/**
 * Frontend mirror of the automation engine's contract (apps/engine).
 *
 * The engine owns the canonical zod schemas (src/artifact.ts for the
 * capability artifact, src/results.ts for the run-result taxonomy,
 * src/evidence.ts for step logs; row shapes in src/db.ts). This module
 * mirrors them so everything crossing the engine boundary — in either
 * direction — is validated with zod on the frontend side too (AGENTS.md:
 * one schema is the single source of truth per side; types are derived
 * with z.infer, never hand-written in parallel). When the engine contract
 * changes, update this mirror in the same change — see NOTES.md.
 */
import { z } from "zod"

// ── Capability artifact (mirror of apps/engine/src/artifact.ts) ──────────

export const artifactVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "version must look like 1.2.3")
export type ArtifactVersion = z.infer<typeof artifactVersionSchema>

/** Risk classification (assignment §3.4). */
export const riskClassSchema = z.enum(["safe", "risky"])
export type RiskClass = z.infer<typeof riskClassSchema>

export const capabilityInputSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, "input names are lowerCamelCase"),
  type: z.enum(["string", "number", "boolean", "enum"]),
  required: z.boolean(),
  description: z.string(),
  /** Allowed values when `type` is "enum". */
  values: z.array(z.string()).optional(),
})
export type CapabilityInput = z.infer<typeof capabilityInputSchema>

export const capabilityOutputSchema = z.object({
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  type: z.enum(["string", "number", "boolean", "date"]),
  description: z.string(),
})
export type CapabilityOutput = z.infer<typeof capabilityOutputSchema>

export const locatorSchema = z.object({
  strategy: z.enum(["a11y", "css", "text"]),
  role: z.string().optional(),
  name: z.string().optional(),
  exact: z.boolean().default(true),
  css: z.string().optional(),
  text: z.string().optional(),
})
export type Locator = z.infer<typeof locatorSchema>

export const targetSchema = z.object({
  primary: locatorSchema,
  fallbacks: z.array(locatorSchema).default([]),
  robustness: z.string(),
})
export type Target = z.infer<typeof targetSchema>

/** The fixed action vocabulary. Discovery cannot invent actions outside it. */
export const stepActionSchema = z.enum([
  "navigate",
  "click",
  "type",
  "select",
  "press",
  "wait",
  "extract",
])
export type StepAction = z.infer<typeof stepActionSchema>

/** Machine-checkable success condition; at least one field must be set. */
export const checkpointSchema = z
  .object({
    urlPattern: z.string().optional(),
    visibleText: z.string().optional(),
    elementPresent: targetSchema.optional(),
    timeoutMs: z.number().int().positive().optional(),
  })
  .refine(
    (c) =>
      c.urlPattern !== undefined ||
      c.visibleText !== undefined ||
      c.elementPresent !== undefined,
    { message: "checkpoint needs at least one condition" }
  )
export type Checkpoint = z.infer<typeof checkpointSchema>

export const capabilityStepSchema = z.object({
  intent: z.string(),
  action: stepActionSchema,
  target: targetSchema.optional(),
  input: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  key: z.string().optional(),
  outputName: z.string().optional(),
  extractKind: z.enum(["text", "value", "page-text-match"]).optional(),
  pattern: z.string().optional(),
  checkpoint: checkpointSchema.optional(),
})
export type CapabilityStep = z.infer<typeof capabilityStepSchema>

export const businessOutcomeSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]*$/),
  description: z.string(),
  detect: z.object({
    urlPattern: z.string().optional(),
    visibleText: z.string().optional(),
  }),
})
export type BusinessOutcome = z.infer<typeof businessOutcomeSchema>

/** The full capability artifact. */
export const capabilityArtifactSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  version: artifactVersionSchema,
  name: z.string(),
  description: z.string(),
  goal: z.string(),
  targetApp: z.string(),
  risk: riskClassSchema,
  createdAt: z.string(),
  discoveryModel: z.string(),
  discoveryRunId: z.string(),
  inputs: z.array(capabilityInputSchema),
  outputs: z.array(capabilityOutputSchema),
  steps: z.array(capabilityStepSchema).min(1),
  checkpoint: checkpointSchema,
  businessOutcomes: z.array(businessOutcomeSchema).default([]),
  reviewed: z.boolean().default(false),
})
export type CapabilityArtifact = z.infer<typeof capabilityArtifactSchema>

/** Parse + validate an artifact from unknown data. */
export const parseCapabilityArtifact = (data: unknown): CapabilityArtifact =>
  capabilityArtifactSchema.parse(data)

// ── Run result taxonomy (mirror of apps/engine/src/results.ts) ──────────

/** Replay finished, checkpoint held, outputs extracted. */
export const runSuccessSchema = z.object({
  status: z.literal("success"),
  capabilityId: z.string(),
  outputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
})
export type RunSuccess = z.infer<typeof runSuccessSchema>

/** An EXPECTED business outcome fired — a legitimate answer, not a crash. */
export const runBusinessOutcomeSchema = z.object({
  status: z.literal("business_outcome"),
  capabilityId: z.string(),
  outcome: z.string(),
  detail: z.string(),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
})
export type RunBusinessOutcome = z.infer<typeof runBusinessOutcomeSchema>

/** A known transient condition; surfaced after retries were exhausted. */
export const runRecoverableSchema = z.object({
  status: z.literal("recoverable"),
  capabilityId: z.string(),
  step: z.number().int(),
  condition: z.string(),
  retryPolicy: z.object({
    attempts: z.number().int(),
    waitedMs: z.number(),
  }),
  detail: z.string(),
  durationMs: z.number(),
})
export type RunRecoverable = z.infer<typeof runRecoverableSchema>

/** A condition that must stop execution with a debuggable error. */
export const runHardFailureSchema = z.object({
  status: z.literal("hard_failure"),
  capabilityId: z.string().optional(),
  step: z.number().int().optional(),
  expected: z.string(),
  observed: z.string(),
  evidenceDir: z.string().optional(),
  durationMs: z.number(),
})
export type RunHardFailure = z.infer<typeof runHardFailureSchema>

export const runResultSchema = z.discriminatedUnion("status", [
  runSuccessSchema,
  runBusinessOutcomeSchema,
  runRecoverableSchema,
  runHardFailureSchema,
])
export type RunResult = z.infer<typeof runResultSchema>

/** Discovery-specific terminal states. */
export const discoveryDoneSchema = z.object({
  status: z.literal("success"),
  goal: z.string(),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
  capabilityId: z.string().optional(),
})
export const discoveryStuckSchema = z.object({
  status: z.literal("stuck"),
  goal: z.string(),
  reason: z.string(),
  step: z.number().int(),
  durationMs: z.number(),
})
export const discoveryStoppedSchema = z.object({
  status: z.literal("stopped"),
  goal: z.string(),
  reason: z.string(),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
})
export type DiscoveryDone = z.infer<typeof discoveryDoneSchema>
export type DiscoveryStuck = z.infer<typeof discoveryStuckSchema>
export type DiscoveryStopped = z.infer<typeof discoveryStoppedSchema>

export const discoveryResultSchema = z.discriminatedUnion("status", [
  discoveryDoneSchema,
  discoveryStuckSchema,
  discoveryStoppedSchema,
  runHardFailureSchema,
])
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>

/**
 * Any stored run result. The engine persists replay results on replay runs
 * and discovery results on discovery runs; the union accepts both so run
 * rows validate regardless of kind.
 */
export const engineRunResultSchema = z.union([
  runResultSchema,
  discoveryResultSchema,
])
export type EngineRunResult = z.infer<typeof engineRunResultSchema>

// ── Wire rows (mirror of apps/engine/src/db.ts + src/server.ts) ─────────

/** Run row status: "awaiting_approval" while a risky replay waits for an
 * operator decision, "running" until finished, then the result's status. */
export const runStatusSchema = z.enum([
  "awaiting_approval",
  "running",
  "success",
  "business_outcome",
  "recoverable",
  "hard_failure",
  "stuck",
  "stopped",
])
export type RunStatus = z.infer<typeof runStatusSchema>

/** Wire shape of one GET /capabilities row (artifact still a JSON string). */
export const engineCapabilityRowSchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  risk: riskClassSchema,
  /** SQLite boolean: 0 | 1. */
  reviewed: z.number().int(),
  createdAt: z.string(),
  /** Full CapabilityArtifact JSON, unparsed on the list endpoint. */
  artifact: z.string(),
})
export type EngineCapabilityRow = z.infer<typeof engineCapabilityRowSchema>

/** Wire shape of one GET /runs row (result still a JSON string or null). */
export const engineRunRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["discovery", "replay"]),
  capabilityId: z.string().nullable(),
  status: runStatusSchema,
  goal: z.string().nullable(),
  targetUrl: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  /** Structured run result JSON (see engineRunResultSchema), when finished. */
  result: z.string().nullable(),
  evidenceDir: z.string().nullable(),
})
export type EngineRunRow = z.infer<typeof engineRunRowSchema>

/** Wire shape of one GET /approvals row (context still a JSON string). */
export const engineInterventionRowSchema = z.object({
  id: z.string(),
  /** Null until the run actually starts (request-first approvals create it
   * up front; it always exists by the time the engine decides). */
  runId: z.string().nullable(),
  kind: z.string(),
  status: z.enum(["pending", "approved", "rejected", "resolved"]),
  reason: z.string(),
  /** Context payload JSON: capability/goal, inputs, step, page state. */
  context: z.string(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  /** Identity (email) of the user/agent that raised the request. */
  requestedBy: z.string().nullable(),
  /** Identity (email) of the operator who decided. Null while pending. */
  decidedBy: z.string().nullable(),
  /** The operator's reason for the decision, when given. */
  decisionReason: z.string().nullable(),
  /** One-time approval token, scoped to the capability and single-use. */
  approvalToken: z.string().nullable(),
  /** The run that consumed the approval token (single-use evidence). */
  consumedByRunId: z.string().nullable(),
})
export type EngineInterventionRow = z.infer<typeof engineInterventionRowSchema>

/** One structured step event in a run log (mirror of evidence.ts). */
export const stepEvidenceSchema = z.object({
  runId: z.string(),
  stepIndex: z.number().int(),
  /** Wall-clock time the step started. */
  at: z.string(),
  action: z.string(),
  /** Human-readable target summary or URL. */
  target: z.string().optional(),
  /** Why this step happened (model rationale or recorded intent). */
  reason: z.string(),
  durationMs: z.number(),
  result: z.enum(["ok", "failed", "skipped"]),
  error: z.string().optional(),
})
export type StepEvidence = z.infer<typeof stepEvidenceSchema>

// ── Domain shapes returned by the client (wire rows, normalized) ────────

/** Capability list item: the row minus the (large) artifact JSON string. */
export const engineCapabilitySummarySchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  risk: riskClassSchema,
  reviewed: z.boolean(),
  createdAt: z.string(),
})
export type EngineCapabilitySummary = z.infer<
  typeof engineCapabilitySummarySchema
>

/** Capability detail: summary plus the parsed, validated artifact. */
export const engineCapabilitySchema = engineCapabilitySummarySchema.extend({
  artifact: capabilityArtifactSchema,
})
export type EngineCapability = z.infer<typeof engineCapabilitySchema>

/** Run row with the stored result parsed and validated. */
export const engineRunSchema = z.object({
  id: z.string(),
  kind: z.enum(["discovery", "replay"]),
  capabilityId: z.string().nullable(),
  status: runStatusSchema,
  goal: z.string().nullable(),
  targetUrl: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  result: engineRunResultSchema.nullable(),
  evidenceDir: z.string().nullable(),
})
export type EngineRun = z.infer<typeof engineRunSchema>

/** The parsed context payload of an intervention. Fields are all optional
 * because the payload differs by kind (approval vs stuck). */
export const interventionContextSchema = z.object({
  capabilityId: z.string().optional(),
  goal: z.string().optional(),
  inputs: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
  source: z.string().optional(),
  stepIndex: z.number().int().optional(),
  intent: z.string().optional(),
  expected: z.string().optional(),
  observed: z.string().optional(),
  url: z.string().optional(),
  screenshotFile: z.string().optional(),
  ariaSnapshot: z.string().optional(),
  selfApproved: z.boolean().optional(),
  executionRunId: z.string().optional(),
})
export type InterventionContext = z.infer<typeof interventionContextSchema>

/** Intervention row with the context payload parsed. */
export const engineInterventionSchema = z.object({
  id: z.string(),
  runId: z.string().nullable(),
  kind: z.string(),
  status: z.enum(["pending", "approved", "rejected", "resolved"]),
  reason: z.string(),
  context: interventionContextSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  requestedBy: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decisionReason: z.string().nullable(),
  approvalToken: z.string().nullable(),
  consumedByRunId: z.string().nullable(),
})
export type EngineIntervention = z.infer<typeof engineInterventionSchema>

/** GET /runs/:id/evidence response. */
export const engineEvidenceSchema = z.object({
  runId: z.string(),
  steps: z.array(stepEvidenceSchema),
})
export type EngineEvidence = z.infer<typeof engineEvidenceSchema>

/** GET /health response. */
export const engineHealthSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
})
export type EngineHealth = z.infer<typeof engineHealthSchema>

/**
 * GET /policy response — the effective safety policy (mirror of
 * `PolicySchema` in apps/engine/src/policy.ts). The engine answers the
 * fully-parsed policy, so every defaulted field is always present on the
 * wire. Redaction is NOT part of this schema: it is engine-side code
 * (`redactText` / `redactValue`) applied to every response and artifact,
 * not an operator-tunable policy field.
 */
export const enginePolicySchema = z.object({
  /** Regexes the current page URL must match (any one) before any action. */
  allowedUrlPatterns: z.array(z.string()).min(1),
  /** Action types the agent may execute. */
  allowedActions: z.array(stepActionSchema).min(1),
  /** Allowed actions treated as safe/reversible; the rest need approval. */
  safeActions: z.array(stepActionSchema),
  /** Capability risk classes that always require an approval token. */
  riskyClassesRequireApproval: z.array(riskClassSchema),
  /** Require human review before a risky capability replays. */
  requireReviewForRisky: z.boolean(),
  /** Max discovery steps before the loop stops itself. */
  maxDiscoverySteps: z.number().int().positive(),
  /** Discovery wall-clock timeout. */
  discoveryTimeoutMs: z.number().int().positive(),
  /** How the engine answers browser-native dialogs (confirm/alert/prompt). */
  dialogHandling: z.enum(["accept", "dismiss"]),
  /** Bounded reload-and-redrive retries after a transient error page. */
  transientErrorMaxReloads: z.number().int().nonnegative(),
  /** How long a stuck run waits for an operator handoff before failing. */
  handoffTimeoutMs: z.number().int().positive(),
})
export type EnginePolicy = z.infer<typeof enginePolicySchema>

// ── Request/response bodies for the mutating endpoints ──────────────────

/** POST /discover body (async; 202 answers with a runId). */
export const discoverRequestSchema = z.object({
  goal: z.string().min(1),
  targetUrl: z.string().min(1),
  model: z.string().optional(),
})
export type DiscoverRequest = z.infer<typeof discoverRequestSchema>

/** POST /replay body (async; 202 answers with a runId). */
export const replayRequestSchema = z.object({
  capabilityId: z.string().min(1),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  approvalToken: z.string().optional(),
})
export type ReplayRequest = z.infer<typeof replayRequestSchema>

/** 202 response of POST /discover and POST /replay. */
export const startRunResponseSchema = z.object({
  runId: z.string(),
})
export type StartRunResponse = z.infer<typeof startRunResponseSchema>

/** POST /approvals body (request-first approval, D-046). requestedBy is
 * attached by the proxy from the session — never trusted from the client. */
export const requestApprovalBodySchema = z.object({
  capabilityId: z.string().min(1),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  reason: z.string().optional(),
})
export type RequestApprovalBody = z.infer<typeof requestApprovalBodySchema>

/** 201 response of POST /approvals. */
export const requestApprovalResponseSchema = z.object({
  id: z.string(),
  runId: z.string(),
})
export type RequestApprovalResponse = z.infer<
  typeof requestApprovalResponseSchema
>

/** POST /approvals/:id/approve | reject body. decidedBy comes from the
 * session (proxy); only the free-text reason crosses from the client. */
export const decideInterventionBodySchema = z.object({
  reason: z.string().optional(),
})
export type DecideInterventionBody = z.infer<
  typeof decideInterventionBodySchema
>

/** POST /approvals/:id/approve response. selfApproved flags that requester
 * and decider coincide (recorded, not blocked — see NOTES). */
export const approveInterventionResponseSchema = z.object({
  id: z.string(),
  runId: z.string().nullable(),
  selfApproved: z.boolean(),
})
export type ApproveInterventionResponse = z.infer<
  typeof approveInterventionResponseSchema
>

/** POST /approvals/:id/reject response. */
export const rejectInterventionResponseSchema = z.object({
  id: z.string(),
  status: z.literal("rejected"),
  selfApproved: z.boolean(),
})
export type RejectInterventionResponse = z.infer<
  typeof rejectInterventionResponseSchema
>

// ── Live-session state + operator actions (D-046 handoff) ───────────────

/** One entry of the session's control log (who did what, when). */
export const controlLogEntrySchema = z.object({
  at: z.string(),
  event: z.string(),
  detail: z.string().optional(),
})
export type ControlLogEntry = z.infer<typeof controlLogEntrySchema>

/** GET /sessions/:runId/state response — the operator's view of the live
 * session. `undefined` fields mean the page could not be observed. */
export const sessionStateSchema = z.object({
  runId: z.string(),
  owner: z.enum(["automation", "human"]),
  paused: z.boolean(),
  url: z.string(),
  aria: z.string().optional(),
  screenshotDataUrl: z.string().optional(),
  controlLog: z.array(controlLogEntrySchema),
})
export type SessionState = z.infer<typeof sessionStateSchema>

/** POST /sessions/:runId/action body — one manual operator step. */
export const sessionActionBodySchema = z.object({
  action: z.enum(["navigate", "click", "type", "select", "press"]),
  role: z.string().optional(),
  name: z.string().optional(),
  value: z.string().optional(),
  key: z.string().optional(),
  url: z.string().optional(),
})
export type SessionActionBody = z.infer<typeof sessionActionBodySchema>

/** POST /sessions/:runId/action response. */
export const sessionActionResponseSchema = z.object({
  detail: z.string(),
  state: sessionStateSchema.optional(),
})
export type SessionActionResponse = z.infer<typeof sessionActionResponseSchema>

/** POST /capabilities/:id/review response. */
export const reviewCapabilityResponseSchema = z.object({
  id: z.string(),
  reviewed: z.literal(true),
})
export type ReviewCapabilityResponse = z.infer<
  typeof reviewCapabilityResponseSchema
>

/** The engine's error body shape (`{ error: string }` on 4xx/5xx). */
export const engineErrorBodySchema = z.object({
  error: z.string(),
})
