/**
 * Live capability invocation for the caller chat (D-046 segregation swap).
 *
 * `invoke_capability` is a FRONTEND tool: its executor runs in the browser
 * and calls the authenticated /api/engine proxy. This module owns the
 * end-to-end flow:
 *
 * - SAFE capability: start a replay and poll the run to its structured
 *   result (success outputs | business outcome | hard failure).
 * - RISKY capability: raise an APPROVAL intervention (requestedBy = the
 *   signed-in chat user, attached by the proxy). The run is NOT executed —
 *   it waits as "awaiting_approval" for a DIFFERENT operator in
 *   /admin/interventions. This executor then polls the intervention until
 *   the operator decides; approval auto-runs the replay, rejection returns
 *   the denial. The chat user can never self-approve: the decision is a
 *   separate authenticated operator action.
 */
import {
  engineCapabilitySchema,
  engineInterventionSchema,
  engineRunSchema,
  requestApprovalBodySchema,
  requestApprovalResponseSchema,
  startRunResponseSchema,
  type EngineCapability,
  type EngineIntervention,
  type EngineRun,
  type RequestApprovalBody,
  type ReplayRequest,
} from "./schemas"
import {
  EngineHttpError,
  EngineOfflineError,
  EngineValidationError,
} from "./errors"
import { z } from "zod"

// One fetch wrapper (kept local so the tool executor stays dependency-light
// and returns typed results, not thrown errors).
const call = async <S extends z.ZodType>(
  schema: S,
  path: string,
  init?: RequestInit
): Promise<z.infer<S>> => {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    })
  } catch {
    throw new EngineOfflineError(path)
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // handled below by the ok/error branches
  }
  if (res.status === 503) {
    throw new EngineOfflineError(
      path,
      (body as { error?: string } | null)?.error ?? "engine offline"
    )
  }
  if (!res.ok) {
    throw new EngineHttpError(
      res.status,
      (body as { error?: string } | null)?.error ??
        `request failed with status ${res.status}`
    )
  }
  try {
    return schema.parse(body)
  } catch {
    throw new EngineValidationError(path)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const startReplay = (input: ReplayRequest): Promise<{ runId: string }> =>
  call(startRunResponseSchema, "/api/engine/replay", {
    method: "POST",
    body: JSON.stringify(input),
  })

const getRun = (id: string): Promise<EngineRun> =>
  call(engineRunSchema, `/api/engine/runs/${encodeURIComponent(id)}`)

const getIntervention = (id: string): Promise<EngineIntervention> =>
  call(
    engineInterventionSchema,
    `/api/engine/approvals/${encodeURIComponent(id)}`
  )

const requestApproval = (
  input: RequestApprovalBody
): Promise<{ id: string; runId: string }> =>
  call(requestApprovalResponseSchema, "/api/engine/approvals", {
    method: "POST",
    body: JSON.stringify(requestApprovalBodySchema.parse(input)),
  })

const getCapabilityDetail = (id: string): Promise<EngineCapability> =>
  call(
    engineCapabilitySchema,
    `/api/engine/capabilities/${encodeURIComponent(id)}`
  )

/** Poll a run until it leaves the in-flight states. */
const waitForRun = async (
  runId: string,
  intervalMs = 2000,
  timeoutMs = 180_000
): Promise<EngineRun> => {
  const start = Date.now()
  for (;;) {
    const run = await getRun(runId)
    if (run.status !== "running" && run.status !== "awaiting_approval") {
      return run
    }
    if (Date.now() - start > timeoutMs) return run
    await sleep(intervalMs)
  }
}

/** Poll an intervention until an operator decides. */
const waitForDecision = async (
  interventionId: string,
  intervalMs = 2500,
  timeoutMs = 30 * 60_000
): Promise<EngineIntervention> => {
  const start = Date.now()
  for (;;) {
    const intervention = await getIntervention(interventionId)
    if (intervention.status !== "pending") return intervention
    if (Date.now() - start > timeoutMs) return intervention
    await sleep(intervalMs)
  }
}

// The discriminated union the toolkit's render branches on.
export type InvokeLiveResult =
  | {
      kind: "success"
      outputs: Record<string, string | number | boolean>
      stepsExecuted: number
      durationMs: number
    }
  | {
      kind: "business_outcome"
      outcome: string
      detail: string
      stepsExecuted: number
      durationMs: number
    }
  | { kind: "hard_failure"; expected: string; observed: string }
  | { kind: "denied"; decidedBy: string | null; decisionReason: string | null }
  | { kind: "engine_offline" }
  | { kind: "error"; message: string }

/**
 * The full invocation. `risky` routes through approval segregation; safe
 * runs straight through. Never throws — the toolkit renders the union.
 */
export const invokeLiveCapability = async (params: {
  capabilityId: string
  inputs: Record<string, string | number | boolean>
  risky: boolean
}): Promise<InvokeLiveResult> => {
  try {
    if (params.risky) {
      // 1. Raise the operator-decidable approval. The run waits.
      const approval = await requestApproval({
        capabilityId: params.capabilityId,
        inputs: params.inputs,
        reason: "Invoked from the caller chat by a signed-in user",
      })
      // 2. Wait for a DIFFERENT operator to decide in /admin/interventions.
      const decided = await waitForDecision(approval.id)
      if (decided.status === "rejected") {
        return {
          kind: "denied",
          decidedBy: decided.decidedBy,
          decisionReason: decided.decisionReason,
        }
      }
      if (decided.status === "pending") {
        return { kind: "error", message: "no operator answered in time" }
      }
      // 3. Approved: the engine auto-started the replay on the same run.
      const run = await waitForRun(decided.runId ?? approval.runId)
      return runToResult(run)
    }
    // Safe capability: run straight through.
    const started = await startReplay({
      capabilityId: params.capabilityId,
      inputs: params.inputs,
    })
    const run = await waitForRun(started.runId)
    return runToResult(run)
  } catch (failure) {
    if (failure instanceof EngineOfflineError) return { kind: "engine_offline" }
    return {
      kind: "error",
      message: failure instanceof Error ? failure.message : String(failure),
    }
  }
}

const runToResult = (run: EngineRun): InvokeLiveResult => {
  const result = run.result
  if (!result) return { kind: "error", message: `run is still ${run.status}` }
  switch (result.status) {
    case "success":
      // Replay success carries outputs; a discovery success carries a goal.
      if (!("outputs" in result)) {
        return { kind: "error", message: "unexpected discovery result" }
      }
      return {
        kind: "success",
        outputs: result.outputs,
        stepsExecuted: result.stepsExecuted,
        durationMs: result.durationMs,
      }
    case "business_outcome":
      return {
        kind: "business_outcome",
        outcome: result.outcome,
        detail: result.detail,
        stepsExecuted: result.stepsExecuted,
        durationMs: result.durationMs,
      }
    case "hard_failure":
      return {
        kind: "hard_failure",
        expected: result.expected,
        observed: result.observed,
      }
    default:
      return { kind: "error", message: `run ended ${result.status}` }
  }
}

/**
 * Live capability details for the list tool. The engine list endpoint
 * returns one row per stored version (no artifact); this dedupes to the
 * latest id and fetches each capability's full detail for inputs/outputs.
 */
export const listLiveCapabilities = async (): Promise<EngineCapability[]> => {
  const rows = await call(
    z.array(z.object({ id: z.string() })),
    "/api/engine/capabilities"
  )
  const ids = [...new Set(rows.map((row) => row.id))]
  return Promise.all(ids.map((id) => getCapabilityDetail(id)))
}
