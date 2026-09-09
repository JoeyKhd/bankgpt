/**
 * Server-side typed client for the automation engine's HTTP API
 * (D-041: the frontend calls the engine server-side; D-023: the engine is
 * its own process). Every response is validated against the mirrored zod
 * schemas in ./schemas.ts before it crosses into the app.
 *
 * SERVER ONLY — import from route handlers and server components. Browser
 * code must go through the /api/engine proxy routes via ./queries.ts; the
 * engine URL is a server-side env var, never exposed to the bundle.
 */
import { z } from "zod"

import {
  EngineHttpError,
  EngineOfflineError,
  EngineValidationError,
} from "./errors"
import {
  approveInterventionResponseSchema,
  decideInterventionBodySchema,
  discoverRequestSchema,
  engineCapabilityRowSchema,
  engineCapabilitySchema,
  engineCapabilitySummarySchema,
  engineEvidenceSchema,
  engineHealthSchema,
  engineInterventionRowSchema,
  engineInterventionSchema,
  engineRunResultSchema,
  engineRunRowSchema,
  engineRunSchema,
  interventionContextSchema,
  rejectInterventionResponseSchema,
  replayRequestSchema,
  requestApprovalBodySchema,
  requestApprovalResponseSchema,
  reviewCapabilityResponseSchema,
  sessionActionBodySchema,
  sessionActionResponseSchema,
  sessionStateSchema,
  startRunResponseSchema,
  type ApproveInterventionResponse,
  type DecideInterventionBody,
  type DiscoverRequest,
  type EngineCapability,
  type EngineCapabilitySummary,
  type EngineEvidence,
  type EngineRunResult,
  type EngineHealth,
  type EngineIntervention,
  type EngineRun,
  type RejectInterventionResponse,
  type ReplayRequest,
  type RequestApprovalBody,
  type RequestApprovalResponse,
  type ReviewCapabilityResponse,
  type SessionActionBody,
  type SessionActionResponse,
  type SessionState,
  type StartRunResponse,
} from "./schemas"

/** Engine base URL from env (D-041); the engine's dev default is port 4011. */
export const getEngineUrl = (): string =>
  (process.env.ENGINE_URL ?? "http://127.0.0.1:4011").replace(/\/+$/, "")

/** Runs start asynchronously (202) and GETs are local; keep a tight budget. */
const ENGINE_TIMEOUT_MS = 8000

// One fetch wrapper for the whole client: network failure → EngineOfflineError
// (callers degrade gracefully), non-2xx → EngineHttpError with the engine's
// own error message, malformed/contract-drifting JSON → EngineValidationError.
const engineFetch = async (
  path: string,
  init?: RequestInit
): Promise<unknown> => {
  let res: Response
  try {
    res = await fetch(`${getEngineUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
      headers: { "content-type": "application/json", ...init?.headers },
    })
  } catch (cause) {
    const timedOut =
      cause instanceof DOMException && cause.name === "TimeoutError"
    throw new EngineOfflineError(
      getEngineUrl(),
      timedOut
        ? `the automation engine at ${getEngineUrl()} did not answer within ${ENGINE_TIMEOUT_MS}ms`
        : `the automation engine is not reachable at ${getEngineUrl()} — start it with \`pnpm --filter engine dev\``
    )
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    if (res.ok) {
      throw new EngineValidationError(path, "the engine sent invalid JSON")
    }
  }

  if (!res.ok) {
    const errorBody = z.object({ error: z.string() }).safeParse(body)
    throw new EngineHttpError(
      res.status,
      errorBody.success
        ? errorBody.data.error
        : `the engine answered with status ${res.status}`
    )
  }
  return body
}

// Parse helper: one uniform validation-failure error for the whole client.
const parse = <S extends z.ZodType>(
  schema: S,
  data: unknown,
  what: string
): z.infer<S> => {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new EngineValidationError(what, parsed.error.message)
  }
  return parsed.data
}

/** GET /health — cheap liveness probe for the console's engine status. */
export const getEngineHealth = async (): Promise<EngineHealth> =>
  parse(engineHealthSchema, await engineFetch("/health"), "GET /health")

/** GET /capabilities — one row per stored version, newest first. */
export const listEngineCapabilities = async (): Promise<
  EngineCapabilitySummary[]
> => {
  const rows = parse(
    z.array(engineCapabilityRowSchema),
    await engineFetch("/capabilities"),
    "GET /capabilities"
  )
  return rows.map((row) =>
    engineCapabilitySummarySchema.parse({
      ...row,
      reviewed: row.reviewed === 1,
    })
  )
}

/** GET /capabilities/:id — the latest version with its parsed artifact. */
export const getEngineCapability = async (
  id: string
): Promise<EngineCapability> => {
  const row = parse(
    engineCapabilityRowSchema,
    await engineFetch(`/capabilities/${encodeURIComponent(id)}`),
    `GET /capabilities/${id}`
  )
  let artifact: unknown
  try {
    artifact = JSON.parse(row.artifact)
  } catch {
    throw new EngineValidationError(`GET /capabilities/${id} artifact`)
  }
  return parse(
    engineCapabilitySchema,
    { ...row, reviewed: row.reviewed === 1, artifact },
    `GET /capabilities/${id}`
  )
}

/** POST /capabilities/:id/review — mark the latest version reviewed. */
export const markEngineCapabilityReviewed = async (
  id: string
): Promise<ReviewCapabilityResponse> =>
  parse(
    reviewCapabilityResponseSchema,
    await engineFetch(`/capabilities/${encodeURIComponent(id)}/review`, {
      method: "POST",
    }),
    `POST /capabilities/${id}/review`
  )

// The engine stores the structured run result as a JSON string column;
// parse + validate it against the taxonomy for the run's kind.
const parseStoredResult = (
  run: z.infer<typeof engineRunRowSchema>
): EngineRunResult | null => {
  if (run.result === null) return null
  let data: unknown
  try {
    data = JSON.parse(run.result)
  } catch {
    throw new EngineValidationError(`run ${run.id} result`)
  }
  return parse(engineRunResultSchema, data, `run ${run.id} result`)
}

const toEngineRun = (row: z.infer<typeof engineRunRowSchema>): EngineRun =>
  engineRunSchema.parse({ ...row, result: parseStoredResult(row) })

/** GET /runs — all discovery and replay runs, newest first. */
export const listEngineRuns = async (): Promise<EngineRun[]> => {
  const rows = parse(
    z.array(engineRunRowSchema),
    await engineFetch("/runs"),
    "GET /runs"
  )
  return rows.map(toEngineRun)
}

/** GET /runs/:id — one run with its parsed result. */
export const getEngineRun = async (id: string): Promise<EngineRun> => {
  const row = parse(
    engineRunRowSchema,
    await engineFetch(`/runs/${encodeURIComponent(id)}`),
    `GET /runs/${id}`
  )
  return toEngineRun(row)
}

/** GET /runs/:id/evidence — the per-step structured log. */
export const getEngineRunEvidence = async (
  id: string
): Promise<EngineEvidence> =>
  parse(
    engineEvidenceSchema,
    await engineFetch(`/runs/${encodeURIComponent(id)}/evidence`),
    `GET /runs/${id}/evidence`
  )

/** Parse one intervention wire row: context is a JSON string column. */
const toEngineIntervention = (
  row: z.infer<typeof engineInterventionRowSchema>
): EngineIntervention => {
  let context: unknown
  try {
    context = JSON.parse(row.context)
  } catch {
    throw new EngineValidationError(`intervention ${row.id} context`)
  }
  return engineInterventionSchema.parse({
    ...row,
    context: interventionContextSchema.parse(context),
  })
}

/** GET /approvals — interventions/approvals, newest first. */
export const listEngineInterventions = async (): Promise<
  EngineIntervention[]
> => {
  const rows = parse(
    z.array(engineInterventionRowSchema),
    await engineFetch("/approvals"),
    "GET /approvals"
  )
  return rows.map(toEngineIntervention)
}

/** GET /approvals/:id — one intervention with parsed context. */
export const getEngineIntervention = async (
  id: string
): Promise<EngineIntervention> => {
  const row = parse(
    engineInterventionRowSchema,
    await engineFetch(`/approvals/${encodeURIComponent(id)}`),
    `GET /approvals/${id}`
  )
  return toEngineIntervention(row)
}

/** POST /approvals — request-first approval (D-046). The proxy attaches
 * requestedBy from the session. 201 answers { id, runId }. */
export const requestEngineApproval = async (
  input: RequestApprovalBody & { requestedBy: string }
): Promise<RequestApprovalResponse> =>
  parse(
    requestApprovalResponseSchema,
    await engineFetch("/approvals", {
      method: "POST",
      body: JSON.stringify(
        requestApprovalBodySchema
          .merge(z.object({ requestedBy: z.string() }))
          .parse(input)
      ),
    }),
    "POST /approvals"
  )

/** POST /approvals/:id/approve — decidedBy comes from the proxy's session.
 * The engine issues a scoped one-time token and starts the run itself. */
export const approveEngineIntervention = async (
  id: string,
  decidedBy: string,
  body: DecideInterventionBody = {}
): Promise<ApproveInterventionResponse> =>
  parse(
    approveInterventionResponseSchema,
    await engineFetch(`/approvals/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify({
        decidedBy,
        ...decideInterventionBodySchema.parse(body),
      }),
    }),
    `POST /approvals/${id}/approve`
  )

/** POST /approvals/:id/reject. */
export const rejectEngineIntervention = async (
  id: string,
  decidedBy: string,
  body: DecideInterventionBody = {}
): Promise<RejectInterventionResponse> =>
  parse(
    rejectInterventionResponseSchema,
    await engineFetch(`/approvals/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({
        decidedBy,
        ...decideInterventionBodySchema.parse(body),
      }),
    }),
    `POST /approvals/${id}/reject`
  )

/** GET /sessions/:runId/state — the operator's view of a live session.
 * 404 (session closed) surfaces as EngineHttpError for the UI to branch on. */
export const getEngineSessionState = async (
  runId: string
): Promise<SessionState> =>
  parse(
    sessionStateSchema,
    await engineFetch(`/sessions/${encodeURIComponent(runId)}/state`),
    `GET /sessions/${runId}/state`
  )

/** POST /sessions/:runId/action — one manual step on the live session
 * (human-owned only; 409 + error message otherwise). */
export const postEngineSessionAction = async (
  runId: string,
  body: SessionActionBody
): Promise<SessionActionResponse> =>
  parse(
    sessionActionResponseSchema,
    await engineFetch(`/sessions/${encodeURIComponent(runId)}`, {
      method: "POST",
      body: JSON.stringify(sessionActionBodySchema.parse(body)),
    }),
    `POST /sessions/${runId}/action`
  )

/** POST /discover — start an async discovery run; 202 answers the runId. */
export const startEngineDiscovery = async (
  input: DiscoverRequest
): Promise<StartRunResponse> =>
  parse(
    startRunResponseSchema,
    await engineFetch("/discover", {
      method: "POST",
      body: JSON.stringify(discoverRequestSchema.parse(input)),
    }),
    "POST /discover"
  )

/** POST /replay — start an async replay run; 202 answers the runId. */
export const startEngineReplay = async (
  input: ReplayRequest
): Promise<StartRunResponse> =>
  parse(
    startRunResponseSchema,
    await engineFetch("/replay", {
      method: "POST",
      body: JSON.stringify(replayRequestSchema.parse(input)),
    }),
    "POST /replay"
  )

/**
 * The three reads the /admin overview needs, in parallel. Throws
 * EngineOfflineError when the engine is down — callers degrade to stubs.
 */
export const getEngineOverview = async (): Promise<{
  capabilities: EngineCapabilitySummary[]
  runs: EngineRun[]
  interventions: EngineIntervention[]
}> => {
  const [capabilities, runs, interventions] = await Promise.all([
    listEngineCapabilities(),
    listEngineRuns(),
    listEngineInterventions(),
  ])
  return { capabilities, runs, interventions }
}
