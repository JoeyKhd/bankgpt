/**
 * Browser-side data layer for the automation engine, on @tanstack/react-query
 * (AGENTS.md: server state always lives in react-query).
 *
 * These fetchers call the /api/engine proxy routes — never the engine
 * directly; ENGINE_URL is a server-side secret. Responses are validated
 * with the mirrored zod schemas, so every consumer gets typed domain
 * objects. Errors are the shared taxonomy from ./errors.ts: branch on
 * isEngineOffline(error) to render the degraded "engine offline" state —
 * the proxy answers 503 when the engine is down.
 */
import { queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import {
  EngineHttpError,
  EngineOfflineError,
  EngineValidationError,
  isEngineOffline,
} from "./errors"
import {
  approveInterventionResponseSchema,
  decideInterventionBodySchema,
  discoverRequestSchema,
  engineCapabilitySchema,
  engineCapabilitySummarySchema,
  engineErrorBodySchema,
  engineEvidenceSchema,
  engineHealthSchema,
  engineInterventionSchema,
  engineRunSchema,
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

/** Domain-shaped query keys for everything the console reads. */
export const engineKeys = {
  all: ["engine"] as const,
  status: () => [...engineKeys.all, "status"] as const,
  capabilities: () => [...engineKeys.all, "capabilities"] as const,
  capability: (id: string) => [...engineKeys.capabilities(), id] as const,
  runs: () => [...engineKeys.all, "runs"] as const,
  run: (id: string) => [...engineKeys.runs(), id] as const,
  runEvidence: (id: string) => [...engineKeys.run(id), "evidence"] as const,
  interventions: () => [...engineKeys.all, "interventions"] as const,
  intervention: (id: string) => [...engineKeys.interventions(), id] as const,
  sessionState: (runId: string) =>
    [...engineKeys.all, "session", runId] as const,
} as const

// One fetch wrapper for the proxy: network failure or a 503 from the proxy
// both mean "engine unreachable" for UI purposes; other non-2xx statuses
// surface the proxy/engine message; 2xx bodies are validated with zod.
const proxyFetch = async <S extends z.ZodType>(
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
    throw new EngineOfflineError(
      path,
      "the app server did not answer — is `pnpm dev` running?"
    )
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // Non-JSON bodies only matter below; the error paths re-read `body`.
  }

  const errorMessage = (fallback: string) => {
    const errorBody = engineErrorBodySchema.safeParse(body)
    return errorBody.success ? errorBody.data.error : fallback
  }

  if (res.status === 503) {
    throw new EngineOfflineError(
      path,
      errorMessage("the automation engine is not reachable")
    )
  }
  if (!res.ok) {
    throw new EngineHttpError(
      res.status,
      errorMessage(`request failed with status ${res.status}`)
    )
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new EngineValidationError(path, parsed.error.message)
  }
  return parsed.data
}

// Don't hammer an unreachable engine; transient HTTP errors get one retry.
const engineRetry = (failureCount: number, error: Error) =>
  !isEngineOffline(error) && failureCount < 2

// ── Query functions ──────────────────────────────────────────────────────

export const fetchEngineStatus = (): Promise<EngineHealth> =>
  proxyFetch(engineHealthSchema, "/api/engine/status")

export const fetchCapabilities = (): Promise<EngineCapabilitySummary[]> =>
  proxyFetch(z.array(engineCapabilitySummarySchema), "/api/engine/capabilities")

export const fetchCapability = (id: string): Promise<EngineCapability> =>
  proxyFetch(
    engineCapabilitySchema,
    `/api/engine/capabilities/${encodeURIComponent(id)}`
  )

export const fetchRuns = (): Promise<EngineRun[]> =>
  proxyFetch(z.array(engineRunSchema), "/api/engine/runs")

export const fetchRun = (id: string): Promise<EngineRun> =>
  proxyFetch(engineRunSchema, `/api/engine/runs/${encodeURIComponent(id)}`)

export const fetchRunEvidence = (id: string): Promise<EngineEvidence> =>
  proxyFetch(
    engineEvidenceSchema,
    `/api/engine/runs/${encodeURIComponent(id)}/evidence`
  )

export const fetchInterventions = (): Promise<EngineIntervention[]> =>
  proxyFetch(z.array(engineInterventionSchema), "/api/engine/approvals")

export const fetchIntervention = (id: string): Promise<EngineIntervention> =>
  proxyFetch(
    engineInterventionSchema,
    `/api/engine/approvals/${encodeURIComponent(id)}`
  )

export const fetchSessionState = (runId: string): Promise<SessionState> =>
  proxyFetch(
    sessionStateSchema,
    `/api/engine/sessions/${encodeURIComponent(runId)}/state`
  )

// ── queryOptions factories (pass straight to useQuery) ──────────────────

/** Engine liveness; errors when the engine is offline. */
export const engineStatusQuery = () =>
  queryOptions({
    queryKey: engineKeys.status(),
    queryFn: fetchEngineStatus,
    retry: engineRetry,
  })

export const capabilitiesQuery = () =>
  queryOptions({
    queryKey: engineKeys.capabilities(),
    queryFn: fetchCapabilities,
    retry: engineRetry,
  })

export const capabilityQuery = (id: string) =>
  queryOptions({
    queryKey: engineKeys.capability(id),
    queryFn: () => fetchCapability(id),
    retry: engineRetry,
  })

export const runsQuery = () =>
  queryOptions({
    queryKey: engineKeys.runs(),
    queryFn: fetchRuns,
    retry: engineRetry,
    // Follow live runs without a manual refresh; stop once all are finished.
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "running") ? 2000 : false,
  })

export const runQuery = (id: string) =>
  queryOptions({
    queryKey: engineKeys.run(id),
    queryFn: () => fetchRun(id),
    retry: engineRetry,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : false,
  })

// No polling here: evidence is an append-only log, and the run queries
// already poll while a run is live — refetch evidence when the run settles.
export const runEvidenceQuery = (id: string) =>
  queryOptions({
    queryKey: engineKeys.runEvidence(id),
    queryFn: () => fetchRunEvidence(id),
    retry: engineRetry,
  })

export const interventionsQuery = () =>
  queryOptions({
    queryKey: engineKeys.interventions(),
    queryFn: fetchInterventions,
    retry: engineRetry,
    // Keep the inbox fresh while anything awaits a human decision.
    refetchInterval: (query) =>
      query.state.data?.some((i) => i.status === "pending") ? 3000 : false,
  })

export const interventionQuery = (id: string) =>
  queryOptions({
    queryKey: engineKeys.intervention(id),
    queryFn: () => fetchIntervention(id),
    retry: engineRetry,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 3000 : false,
  })

/** Live session state for the take-over panel; polls while the session is
 * open so the operator sees the page as automation leaves it. */
export const sessionStateQuery = (runId: string) =>
  queryOptions({
    queryKey: engineKeys.sessionState(runId),
    queryFn: () => fetchSessionState(runId),
    retry: false,
    refetchInterval: 2500,
  })

// ── Mutation functions (wrap in useMutation where consumed) ─────────────

export const startDiscovery = (
  input: DiscoverRequest
): Promise<StartRunResponse> =>
  proxyFetch(startRunResponseSchema, "/api/engine/discover", {
    method: "POST",
    body: JSON.stringify(discoverRequestSchema.parse(input)),
  })

export const startReplay = (input: ReplayRequest): Promise<StartRunResponse> =>
  proxyFetch(startRunResponseSchema, "/api/engine/replay", {
    method: "POST",
    body: JSON.stringify(replayRequestSchema.parse(input)),
  })

export const requestApproval = (
  input: RequestApprovalBody
): Promise<RequestApprovalResponse> =>
  proxyFetch(requestApprovalResponseSchema, "/api/engine/approvals", {
    method: "POST",
    body: JSON.stringify(requestApprovalBodySchema.parse(input)),
  })

export const approveIntervention = (
  id: string,
  body: DecideInterventionBody = {}
): Promise<ApproveInterventionResponse> =>
  proxyFetch(
    approveInterventionResponseSchema,
    `/api/engine/approvals/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      body: JSON.stringify(decideInterventionBodySchema.parse(body)),
    }
  )

export const rejectIntervention = (
  id: string,
  body: DecideInterventionBody = {}
): Promise<RejectInterventionResponse> =>
  proxyFetch(
    rejectInterventionResponseSchema,
    `/api/engine/approvals/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      body: JSON.stringify(decideInterventionBodySchema.parse(body)),
    }
  )

export const postSessionAction = (
  runId: string,
  body: SessionActionBody
): Promise<SessionActionResponse> =>
  proxyFetch(
    sessionActionResponseSchema,
    `/api/engine/sessions/${encodeURIComponent(runId)}/action`,
    { method: "POST", body: JSON.stringify(sessionActionBodySchema.parse(body)) }
  )

export const markCapabilityReviewed = (
  id: string
): Promise<ReviewCapabilityResponse> =>
  proxyFetch(
    reviewCapabilityResponseSchema,
    `/api/engine/capabilities/${encodeURIComponent(id)}/review`,
    { method: "POST" }
  )
