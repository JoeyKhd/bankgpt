/**
 * Live capability invocation for the caller chat (D-046 segregation swap,
 * two-phase approval flow from D-056).
 *
 * `invoke_capability` is a FRONTEND tool: its executor runs in the browser
 * and calls the authenticated /api/engine proxy. This module owns the
 * end-to-end flow:
 *
 * - SAFE capability: start a replay and poll the run to its structured
 *   result (success outputs | business outcome | hard failure). The wait is
 *   seconds, so the executor holds the tool call open.
 * - RISKY capability: raise an APPROVAL intervention (requestedBy = the
 *   signed-in chat user, attached by the proxy) and return IMMEDIATELY with
 *   an `approval_pending` marker carrying the intervention + run ids. The
 *   run is NOT executed — it waits as "awaiting_approval" for a DIFFERENT
 *   operator in /admin/interventions.
 *
 * The risky path must not hold the tool call open: while a frontend tool
 * awaits, the chat never settles, so nothing persists and a closed tab
 * loses the exchange. Returning `approval_pending` lets the turn complete
 * and persist; the tool-call renderer then watches the intervention and
 * completes the call with `addResult` once the operator decides (approval
 * auto-runs the replay, rejection returns the denial) — even after the user
 * closed and reopened the thread, because the persisted marker carries the
 * ids. The chat user can never self-approve: the decision is a separate
 * authenticated operator action.
 */
import {
  engineCapabilitySchema,
  engineRunSchema,
  requestApprovalBodySchema,
  requestApprovalResponseSchema,
  startRunResponseSchema,
  type EngineCapability,
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

/** Poll a run until it leaves the in-flight states. Only used for SAFE
 * capabilities (seconds); risky ones return `approval_pending` immediately
 * and let the tool-call renderer watch the decision. */
const waitForRun = async (
  runId: string,
  intervalMs = 1000,
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
  | {
      // Risky invocation, phase one: the approval request is raised and the
      // run waits as awaiting_approval. NOT a terminal state — the renderer
      // watches the intervention and completes the call with the real
      // outcome once the operator decides. The ids make the wait resumable
      // after a page reload.
      kind: "approval_pending"
      interventionId: string
      runId: string
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
      // Raise the operator-decidable approval and return IMMEDIATELY: the
      // run waits as awaiting_approval for a DIFFERENT operator in
      // /admin/interventions. Holding the tool call open while waiting
      // would block persistence and die with the tab — the renderer watches
      // the decision and completes the call (see the module docstring).
      const approval = await requestApproval({
        capabilityId: params.capabilityId,
        inputs: params.inputs,
        reason: "Invoked from the caller chat by a signed-in user",
      })
      return {
        kind: "approval_pending",
        interventionId: approval.id,
        runId: approval.runId,
      }
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

// Exported for the toolkit's approval watcher: phase two of a risky
// invocation converts the finished run into the same terminal union (never
// approval_pending — a finished run is a terminal answer).
export const runToResult = (
  run: EngineRun
): Exclude<InvokeLiveResult, { kind: "approval_pending" }> => {
  const result = run.result
  if (!result) {
    return {
      kind: "error",
      message: `run ended without a result (status: ${run.status})`,
    }
  }
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
