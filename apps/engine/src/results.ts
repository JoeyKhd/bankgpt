/**
 * Structured run results (assignment §3.3): the discriminated-union taxonomy
 * every replay (and discovery) run ends in. The caller always receives one of
 * these — never a thrown exception for an expected runtime condition.
 */
import { z } from "zod"

/** Replay finished, checkpoint held, outputs extracted. */
export const RunSuccessSchema = z.object({
  status: z.literal("success"),
  capabilityId: z.string(),
  outputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
})

/** An EXPECTED business outcome fired — a legitimate answer, not a crash. */
export const RunBusinessOutcomeSchema = z.object({
  status: z.literal("business_outcome"),
  capabilityId: z.string(),
  /** Machine-readable code, e.g. "member_not_found". */
  outcome: z.string(),
  detail: z.string(),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
})

/**
 * A known, transient condition matched a recoverable rule and the step was
 * retried up to its retry policy. Surfaced when retries were exhausted but
 * the condition is classified as recoverable rather than a hard failure.
 */
export const RunRecoverableSchema = z.object({
  status: z.literal("recoverable"),
  capabilityId: z.string(),
  step: z.number().int(),
  condition: z.string(),
  /** What the retry policy was and how often it fired. */
  retryPolicy: z.object({
    attempts: z.number().int(),
    waitedMs: z.number(),
  }),
  detail: z.string(),
  durationMs: z.number(),
})

/** A condition that must stop execution with a debuggable error. */
export const RunHardFailureSchema = z.object({
  status: z.literal("hard_failure"),
  capabilityId: z.string().optional(),
  step: z.number().int().optional(),
  expected: z.string(),
  observed: z.string(),
  durationMs: z.number(),
})

/** Discovery-specific terminal states. */
export const DiscoveryDoneSchema = z.object({
  status: z.literal("success"),
  goal: z.string(),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
  /** Id of the distilled capability artifact, when distillation succeeded. */
  capabilityId: z.string().optional(),
})
export const DiscoveryStuckSchema = z.object({
  status: z.literal("stuck"),
  goal: z.string(),
  reason: z.string(),
  step: z.number().int(),
  durationMs: z.number(),
})
export const DiscoveryStoppedSchema = z.object({
  status: z.literal("stopped"),
  goal: z.string(),
  reason: z.string(),
  stepsExecuted: z.number().int(),
  durationMs: z.number(),
})

export const RunResultSchema = z.discriminatedUnion("status", [
  RunSuccessSchema,
  RunBusinessOutcomeSchema,
  RunRecoverableSchema,
  RunHardFailureSchema,
])
export type RunResult = z.infer<typeof RunResultSchema>

export const DiscoveryResultSchema = z.discriminatedUnion("status", [
  DiscoveryDoneSchema,
  DiscoveryStuckSchema,
  DiscoveryStoppedSchema,
  RunHardFailureSchema,
])
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>
