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

/** Run row status: "running" until finished, then the result's status. */
export const runStatusSchema = z.enum([
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
  runId: z.string(),
  kind: z.string(),
  status: z.enum(["pending", "approved", "rejected", "resolved"]),
  reason: z.string(),
  /** Context payload JSON: current step, page state, screenshot path. */
  context: z.string(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  /** One-time token issued on approval; replay checks its presence. */
  approvalToken: z.string().nullable(),
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

/** Intervention row with the context payload parsed. */
export const engineInterventionSchema = z.object({
  id: z.string(),
  runId: z.string(),
  kind: z.string(),
  status: z.enum(["pending", "approved", "rejected", "resolved"]),
  reason: z.string(),
  context: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  approvalToken: z.string().nullable(),
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

/** POST /approvals/:id/approve response — carries the one-time token. */
export const approveInterventionResponseSchema = z.object({
  id: z.string(),
  approvalToken: z.string(),
})
export type ApproveInterventionResponse = z.infer<
  typeof approveInterventionResponseSchema
>

/** POST /approvals/:id/reject response. */
export const rejectInterventionResponseSchema = z.object({
  id: z.string(),
  status: z.literal("rejected"),
})
export type RejectInterventionResponse = z.infer<
  typeof rejectInterventionResponseSchema
>

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
