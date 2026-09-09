/**
 * Engine server (D-041 + D-046): Hono HTTP API + WebSocket control channel
 * (@hono/node-server).
 *
 * HTTP (JSON):
 *   GET  /health
 *   GET  /policy                        the effective safety policy (read-only)
 *   GET  /capabilities
 *   GET  /capabilities/:id
 *   POST /capabilities                    save/upsert an artifact
 *   POST /capabilities/:id/review         mark reviewed:true
 *   POST /discover                        start a discovery run (async)
 *   POST /replay                          start a replay run (async)
 *   GET  /runs
 *   GET  /runs/:id                        run row + parsed result
 *   GET  /runs/:id/evidence               steps.jsonl contents
 *   GET  /approvals                       list interventions/approvals
 *   POST /approvals                       request approval for a risky replay
 *                                         (creates the run, status
 *                                         "awaiting_approval")
 *   GET  /approvals/:id                   one intervention
 *   POST /approvals/:id/approve           decide + auto-start the run
 *   POST /approvals/:id/reject            decide + stop the run
 *   GET  /sessions/:runId/state           live session state (screenshot, aria,
 *                                         ownership, control log)
 *   GET  /sessions/:runId                 same state (unsuffixed alias)
 *   POST /sessions/:runId/action          execute a manual operator action on
 *                                         the live session (human-owned only)
 *   POST /sessions/:runId                 same action (unsuffixed alias)
 *
 * Request bodies are validated with @hono/zod-validator against the zod
 * schemas below; failures answer the same `{ error }` shape and status the
 * hand-rolled checks produced. Every JSON response is redacted through
 * policy.redactValue before it leaves the process.
 *
 * Approval segregation (D-046): a risky capability never runs on the
 * requester's own say-so. The requester (chat user, CLI, API caller) raises
 * an approval intervention carrying capability + inputs + requestedBy; a
 * human operator approves or rejects with decidedBy + reason; approval
 * issues a one-time token SCOPED to the capability and consumed by exactly
 * one run, and the engine starts the run itself. When requester and
 * decider coincide (single-account demo) the decision is still recorded —
 * flagged selfApproved — rather than blocked.
 *
 * Live-session handoff (assignment §3.6): every server run drives a
 * registered LiveSession (src/session.ts). A stuck run (step failed all
 * retries with no business outcome, or the discovery model reports stuck)
 * captures the page, raises a "stuck" intervention, and pauses until an
 * operator takes control (cede), performs manual steps on the SAME page,
 * and hands control back (resume); the run then continues. Human actions
 * are recorded into the run's evidence (steps.jsonl + control.json).
 *
 * WebSocket (/ws): step events for discovery AND replay + control channel
 * (pause/cede/resume/human-action) for the handoff.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { WSContext } from "hono/ws"
import { serve, upgradeWebSocket, type WebSocketLike } from "@hono/node-server"
import { zValidator } from "@hono/zod-validator"
import { WebSocketServer } from "ws"
import { chromium, type Browser } from "playwright"
import type Database from "better-sqlite3"
import { z } from "zod"
import { CapabilityArtifactSchema } from "@/artifact"
import {
  getCapability,
  getCapabilityVersion,
  hashCapabilityRow,
  insertCapability,
  listCapabilities,
  setCapabilityReviewed,
  insertRun,
  finishRun,
  setRunStatus,
  getRun,
  listRuns,
  insertIntervention,
  getIntervention,
  listInterventions,
  resolveIntervention,
  mergeInterventionContext,
  findInterventionByToken,
  consumeApprovalToken,
  type CapabilityRow,
  type InterventionRow,
} from "@/db"
import { runDiscovery } from "@/discovery"
import { replayCapability, validateInputs } from "@/replay"
import {
  defaultPolicy,
  redactText,
  redactValue,
  ApprovalRequiredError,
  type Policy,
} from "@/policy"
import { createEvidenceWriter, type EvidenceWriter } from "@/evidence"
import {
  createLiveSession,
  closeLiveSession,
  pauseSession,
  cedeSession,
  resumeSession,
  recordHumanAction,
  waitForAutomation,
  getSession,
  listSessions,
  type LiveSession,
} from "@/session"

export type ServerOptions = {
  port: number
  db: Database.Database
  evidenceDir: string
  policy?: Policy
  /** OpenRouter key for discovery; read from env when omitted. */
  openRouterApiKey?: string
  /** Default discovery model. */
  discoveryModel?: string
}

const DEFAULT_MODEL = "google/gemini-2.5-flash"

/** Every JSON response leaves through policy redaction, exactly as before. */
const json = <T>(c: Context, status: ContentfulStatusCode, body: T): Response =>
  c.json(redactValue(body) as T, status)

/** ws/WebSocket.OPEN — WSContext exposes the raw readyState number. */
const WS_OPEN = 1

// ---------------------------------------------------------------------------
// Request body schemas (zod; enforced by @hono/zod-validator). The per-field
// `error` strings keep the exact messages the hand-rolled checks answered.
// ---------------------------------------------------------------------------

const replayInputsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
)

const discoverBodySchema = z.object({
  goal: z
    .string({ error: "goal and targetUrl are required" })
    .min(1, "goal and targetUrl are required"),
  targetUrl: z
    .string({ error: "goal and targetUrl are required" })
    .min(1, "goal and targetUrl are required"),
  model: z.string().optional(),
})

const replayBodySchema = z.object({
  capabilityId: z
    .string({ error: "capabilityId is required" })
    .min(1, "capabilityId is required"),
  inputs: replayInputsSchema.optional(),
  approvalToken: z.string().optional(),
  requestedBy: z.string().optional(),
})

const approvalRequestBodySchema = z.object({
  capabilityId: z
    .string({ error: "capabilityId and requestedBy are required" })
    .min(1, "capabilityId and requestedBy are required"),
  inputs: replayInputsSchema.optional(),
  requestedBy: z
    .string({ error: "capabilityId and requestedBy are required" })
    .min(1, "capabilityId and requestedBy are required"),
  reason: z.string().optional(),
})

const decisionBodySchema = z.object({
  decidedBy: z
    .string({ error: "decidedBy is required" })
    .min(1, "decidedBy is required"),
  reason: z.string().optional(),
})

/** Loose shape only — executeHumanAction owns action-level errors (409s). */
const sessionActionBodySchema = z.object({
  action: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  value: z.string().optional(),
  key: z.string().optional(),
  url: z.string().optional(),
  operator: z.string().optional(),
})

/** Shared validation hook: first issue message, same `{ error }` shape. */
// Inbound WebSocket control messages (pause / cede / resume / human-action).
const wsControlMessageSchema = z.object({
  type: z.enum(["pause", "cede", "resume", "human-action"]),
  runId: z.string().min(1),
  operator: z.string().max(200).optional(),
  detail: z.string().max(2000).optional(),
})

const invalidBody = (
  error: { issues: ReadonlyArray<{ message: string }> },
  c: Context
): Response =>
  json(c, 400, { error: error.issues[0]?.message ?? "invalid request body" })

const artifactBody = zValidator("json", CapabilityArtifactSchema, (r, c) => {
  // An unparseable artifact previously threw into the catch-all (500).
  if (!r.success) return json(c, 500, { error: r.error.message })
})
const discoverBody = zValidator("json", discoverBodySchema, (r, c) => {
  if (!r.success) return invalidBody(r.error, c)
})
const replayBody = zValidator("json", replayBodySchema, (r, c) => {
  if (!r.success) return invalidBody(r.error, c)
})
const approvalRequestBody = zValidator(
  "json",
  approvalRequestBodySchema,
  (r, c) => {
    if (!r.success) return invalidBody(r.error, c)
  }
)
const decisionBody = zValidator("json", decisionBodySchema, (r, c) => {
  if (!r.success) return invalidBody(r.error, c)
})
const sessionActionBody = zValidator(
  "json",
  sessionActionBodySchema,
  (r, c) => {
    if (!r.success) return invalidBody(r.error, c)
  }
)

type ReplayInputs = z.infer<typeof replayInputsSchema>

export const startEngineServer = (options: ServerOptions) => {
  const policy = options.policy ?? defaultPolicy()
  const apiKey =
    options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY ?? ""
  const discoveryModel = options.discoveryModel ?? DEFAULT_MODEL
  const { db, evidenceDir } = options

  // One shared headless browser for replay/discovery sessions.
  let browserPromise: Promise<Browser> | undefined
  const getBrowser = (): Promise<Browser> => {
    browserPromise ??= chromium.launch({ headless: true })
    return browserPromise
  }

  /** Evidence writers of in-flight runs, so human actions land in the log. */
  const activeEvidence = new Map<string, EvidenceWriter>()

  const wsClients = new Set<WSContext<WebSocketLike>>()
  const broadcast = (event: unknown): void => {
    const payload = JSON.stringify(redactValue(event))
    for (const client of wsClients) {
      if (client.readyState === WS_OPEN) client.send(payload)
    }
  }

  const broadcastControlState = (runId: string, applied: boolean): void => {
    const session = getSession(runId)
    broadcast({
      type: "control-state",
      runId,
      applied,
      owner: session?.owner ?? "automation",
      paused: session?.paused ?? false,
    })
  }

  /** End-of-run bookkeeping: result, control log, session teardown, events. */
  const completeRun = async (
    runId: string,
    result: { status: string },
    evidence: EvidenceWriter
  ): Promise<void> => {
    const session = getSession(runId)
    if (session) {
      writeFileSync(
        join(evidence.runDir, "control.json"),
        JSON.stringify(redactValue(session.controlLog), null, 2)
      )
    }
    finishRun(db, runId, result.status, JSON.stringify(result))
    activeEvidence.delete(runId)
    broadcast({ type: "run-finished", runId, result })
    if (session) {
      await closeLiveSession(runId)
      broadcast({ type: "session-closed", runId })
    }
  }

  /**
   * The stuck-escalation seam (assignment §3.6). Captures the live page,
   * raises a "stuck" intervention with full context, pauses the run, and
   * waits for an operator to hand control back (resume) or for the
   * handoff timeout. Resolves to true when the run may continue.
   */
  const makeStuckHandoff = (params: {
    runId: string
    evidence: EvidenceWriter
    session: LiveSession
    contextBase: Record<string, unknown>
  }) => ({
    onStuck: async (info: {
      stepIndex?: number
      intent?: string
      expected?: string
      observed?: string
      reason?: string
    }): Promise<boolean> => {
      const { runId, evidence, session } = params
      const stepIndex = info.stepIndex ?? 0
      let screenshotFile: string | undefined
      let ariaText: string | undefined
      try {
        const shot = await session.page.screenshot({ fullPage: true })
        const aria = await session.page.ariaSnapshot().catch(() => undefined)
        const base = `handoff-step-${stepIndex}`
        writeFileSync(join(evidence.runDir, `${base}.png`), shot)
        if (aria) {
          writeFileSync(join(evidence.runDir, `${base}.yml`), redactText(aria))
          ariaText = aria.slice(0, 3000)
        }
        screenshotFile = `${base}.png`
      } catch {
        // Evidence capture must never mask the escalation itself.
      }
      const reason = info.observed ?? info.reason ?? "stuck"
      const interventionId = randomUUID()
      insertIntervention(db, {
        id: interventionId,
        runId,
        kind: "stuck",
        status: "pending",
        reason,
        context: JSON.stringify({
          ...params.contextBase,
          stepIndex,
          intent: info.intent ?? info.expected,
          expected: info.expected,
          observed: info.observed,
          url: session.page.url(),
          screenshotFile,
          ariaSnapshot: ariaText,
        }),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        requestedBy: "engine",
        decidedBy: null,
        decisionReason: null,
        approvalToken: null,
        consumedByRunId: null,
      })
      broadcast({
        type: "intervention-requested",
        runId,
        interventionId,
        kind: "stuck",
      })
      // Automation stops; ownership passes to whoever takes control. The
      // resume handler resolves this intervention with the operator name.
      pauseSession(runId)
      broadcastControlState(runId, true)
      const outcome = await waitForAutomation(session, policy.handoffTimeoutMs)
      if (outcome === "resumed") return true
      resolveIntervention(db, interventionId, "resolved", {
        decidedBy: "engine",
        decisionReason: `handoff timed out after ${policy.handoffTimeoutMs}ms without an operator resuming`,
      })
      broadcast({
        type: "intervention-resolved",
        interventionId,
        runId,
        status: "resolved",
      })
      return false
    },
  })

  /** Register a run row + evidence writer and (unless the run only awaits
   * an approval decision) open its live session. */
  const prepareRun = async (params: {
    runId: string
    kind: "discovery" | "replay"
    capabilityId: string | null
    goal: string | null
    targetUrl: string | null
    status?: string
    withSession?: boolean
  }): Promise<{ evidence: EvidenceWriter; session?: LiveSession }> => {
    const evidence = createEvidenceWriter(evidenceDir, params.runId)
    insertRun(db, {
      id: params.runId,
      kind: params.kind,
      capabilityId: params.capabilityId,
      status: params.status ?? "running",
      goal: params.goal,
      targetUrl: params.targetUrl,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      result: null,
      evidenceDir: evidence.runDir,
    })
    activeEvidence.set(params.runId, evidence)
    if (params.withSession === false) return { evidence }
    const session = await createLiveSession(await getBrowser(), params.runId)
    broadcast({
      type: "session-opened",
      runId: params.runId,
      owner: session.owner,
      paused: session.paused,
    })
    return { evidence, session }
  }

  /**
   * Execute a replay run on its live session. The run row must already
   * exist (prepareRun). Consumes the approval token when one authorized it.
   */
  const launchReplayRun = (params: {
    runId: string
    capabilityRow: CapabilityRow
    inputs: ReplayInputs
    approved: boolean
    /** Intervention whose token authorized this run (single-use). */
    approvalInterventionId?: string
    evidence: EvidenceWriter
    session: LiveSession
  }): void => {
    const { runId, capabilityRow, inputs, evidence, session } = params
    if (params.approvalInterventionId) {
      consumeApprovalToken(db, params.approvalInterventionId, runId)
    }
    void (async () => {
      try {
        const result = await replayCapability({
          browser: await getBrowser(),
          artifact: JSON.parse(capabilityRow.artifact),
          inputs,
          policy,
          evidence,
          runId,
          approved: params.approved,
          session,
          handoff: makeStuckHandoff({
            runId,
            evidence,
            session,
            contextBase: { capabilityId: capabilityRow.id },
          }),
          events: {
            onStep: (stepIndex, step, ok) =>
              broadcast({
                type: "run-step",
                runId,
                stepIndex,
                action: step.action,
                intent: step.intent,
                ok,
              }),
          },
        })
        evidence.writeResult(result)
        await completeRun(runId, result, evidence)
      } catch (err) {
        // ApprovalRequiredError: a risky replay without an approval — the
        // run fails fast and the request becomes an operator-decidable
        // approval intervention carrying the original inputs (D-046).
        const result = {
          status: "hard_failure" as const,
          capabilityId: capabilityRow.id,
          expected: "replay completes",
          observed: err instanceof Error ? err.message : String(err),
          evidenceDir: evidence.runDir,
          durationMs: 0,
        }
        evidence.writeResult(result)
        if (err instanceof ApprovalRequiredError) {
          const interventionId = randomUUID()
          insertIntervention(db, {
            id: interventionId,
            runId,
            kind: "approval",
            status: "pending",
            reason: result.observed,
            context: JSON.stringify({
              capabilityId: capabilityRow.id,
              inputs,
              source: "engine",
            }),
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            requestedBy: null,
            decidedBy: null,
            decisionReason: null,
            approvalToken: null,
            consumedByRunId: null,
          })
          broadcast({
            type: "intervention-requested",
            runId,
            interventionId,
            kind: "approval",
          })
        }
        await completeRun(runId, result, evidence)
      }
    })()
  }

  /**
   * Verify a presented approval token: it must exist, be approved, be
   * scoped to THIS capability, and not yet consumed by another run.
   */
  const checkApprovalToken = (
    capabilityId: string,
    token: string
  ):
    | { ok: true; intervention: InterventionRow }
    | { ok: false; error: string } => {
    const row = findInterventionByToken(db, token)
    if (!row) return { ok: false, error: "unknown approval token" }
    if (row.status !== "approved") {
      return { ok: false, error: `approval is ${row.status}, not approved` }
    }
    if (row.consumedByRunId) {
      return {
        ok: false,
        error: `approval token already consumed by run ${row.consumedByRunId}`,
      }
    }
    let capability: unknown
    try {
      capability = (JSON.parse(row.context) as { capabilityId?: unknown })
        .capabilityId
    } catch {
      return { ok: false, error: "approval has an unreadable context" }
    }
    if (capability !== capabilityId) {
      return {
        ok: false,
        error: `approval token is scoped to capability "${String(capability)}", not "${capabilityId}"`,
      }
    }
    return { ok: true, intervention: row }
  }

  /** Snapshot a live session for the operator surface. */
  const sessionState = async (runId: string) => {
    const session = getSession(runId)
    if (!session) return undefined
    const [aria, shot] = await Promise.all([
      session.page.ariaSnapshot().catch(() => undefined),
      session.page.screenshot().catch(() => undefined),
    ])
    return {
      runId,
      owner: session.owner,
      paused: session.paused,
      url: session.page.url(),
      aria: aria ? aria.slice(0, 4000) : undefined,
      screenshotDataUrl: shot
        ? `data:image/png;base64,${shot.toString("base64")}`
        : undefined,
      controlLog: session.controlLog,
    }
  }

  /**
   * Execute one manual operator action on the live session's page. Only
   * while a human owns the session — automation never races the operator.
   * Every action is recorded into the control log and the run evidence.
   */
  const executeHumanAction = async (
    runId: string,
    body: {
      action?: string
      role?: string
      name?: string
      value?: string
      key?: string
      url?: string
      operator?: string
    }
  ): Promise<{ ok: true; detail: string } | { ok: false; error: string }> => {
    const session = getSession(runId)
    if (!session) return { ok: false, error: "no live session for this run" }
    if (session.owner !== "human") {
      return {
        ok: false,
        error: "automation owns the session — cede control before acting",
      }
    }
    const page = session.page
    const byRole = () =>
      page.getByRole(body.role as never, { name: body.name ?? "", exact: true })
    let detail: string
    try {
      switch (body.action) {
        case "navigate": {
          if (!body.url) return { ok: false, error: "navigate needs url" }
          const target = new URL(body.url, page.url()).toString()
          await page.goto(target, { waitUntil: "domcontentloaded" })
          detail = `navigated to ${target}`
          break
        }
        case "click":
          await byRole().first().click()
          detail = `clicked ${body.role} "${body.name}"`
          break
        case "type":
          await byRole()
            .first()
            .fill(body.value ?? "")
          detail = `typed into ${body.role} "${body.name}"`
          break
        case "select":
          await byRole()
            .first()
            .selectOption({ label: body.value ?? "" })
          detail = `selected "${body.value}" in ${body.role} "${body.name}"`
          break
        case "press":
          if (body.role && body.name) {
            await byRole()
              .first()
              .press(body.key ?? "Enter")
          } else {
            await page.keyboard.press(body.key ?? "Enter")
          }
          detail = `pressed ${body.key ?? "Enter"}`
          break
        default:
          return { ok: false, error: `unknown action "${body.action}"` }
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
    const record = `${body.operator ?? "operator"}: ${detail}`
    recordHumanAction(runId, record)
    activeEvidence.get(runId)?.logStep({
      runId,
      stepIndex: -1,
      at: new Date().toISOString(),
      action: "human-action",
      target: page.url(),
      reason: record,
      durationMs: 0,
      result: "ok",
    })
    broadcast({ type: "human-action", runId, detail: record })
    return { ok: true, detail }
  }

  const app = new Hono()

  // The old catch-all: any unexpected throw answers 500 { error }. The
  // validator raises HTTPException(400) for malformed JSON bodies — keep its
  // status but the same JSON shape.
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      // Raised by the validator for malformed JSON bodies (status 400);
      // keep its status but answer the same redacted { error } JSON shape.
      return new Response(JSON.stringify(redactValue({ error: err.message })), {
        status: err.status,
        headers: { "content-type": "application/json" },
      })
    }
    return json(c, 500, {
      error: err instanceof Error ? err.message : String(err),
    })
  })
  app.notFound((c) => json(c, 404, { error: "not found" }))

  app.get("/health", (c) => json(c, 200, { ok: true, service: "engine" }))

  // The effective safety policy (assignment §3.4), read-only: the console
  // renders this verbatim instead of a hardcoded stub. The policy is code/
  // config — `defaultPolicy()` here, or `ServerOptions.policy` injected by
  // the host process; there is deliberately no PUT/POST editor.
  app.get("/policy", (c) => json(c, 200, policy))

  app.get("/capabilities", (c) => json(c, 200, listCapabilities(db)))

  app.get("/capabilities/:id", (c) => {
    const row = getCapability(db, c.req.param("id"))
    return row
      ? json(c, 200, row)
      : json(c, 404, { error: "capability not found" })
  })

  app.post("/capabilities", artifactBody, (c) => {
    const artifact = c.req.valid("json")
    insertCapability(db, {
      id: artifact.id,
      version: artifact.version,
      name: artifact.name,
      risk: artifact.risk,
      reviewed: artifact.reviewed ? 1 : 0,
      createdAt: artifact.createdAt,
      artifact: JSON.stringify(artifact),
    })
    return json(c, 201, { id: artifact.id, version: artifact.version })
  })

  app.post("/capabilities/:id/review", (c) => {
    const id = c.req.param("id")
    const row = getCapability(db, id)
    if (!row) return json(c, 404, { error: "capability not found" })
    setCapabilityReviewed(db, id, true)
    return json(c, 200, { id, version: row.version, reviewed: true })
  })

  app.post("/discover", discoverBody, async (c) => {
    const body = c.req.valid("json")
    const runId = randomUUID()
    const { evidence, session } = await prepareRun({
      runId,
      kind: "discovery",
      capabilityId: null,
      goal: body.goal,
      targetUrl: body.targetUrl,
    })
    if (!session) throw new Error("live session was not created")
    // Runs async; clients follow progress on the WS channel or poll /runs/:id.
    void (async () => {
      try {
        const result = await runDiscovery({
          goal: body.goal,
          targetUrl: body.targetUrl,
          policy,
          evidence,
          runId,
          model: body.model ?? discoveryModel,
          apiKey,
          browser: await getBrowser(),
          session,
          handoff: makeStuckHandoff({
            runId,
            evidence,
            session,
            contextBase: { goal: body.goal },
          }),
          events: {
            onStep: (stepIndex, decision, ok) =>
              broadcast({
                type: "run-step",
                runId,
                stepIndex,
                action: decision.action,
                intent: decision.reasoning,
                ok,
              }),
          },
          onArtifact: (artifact) => {
            insertCapability(db, {
              id: artifact.id,
              version: artifact.version,
              name: artifact.name,
              risk: artifact.risk,
              reviewed: 0,
              createdAt: artifact.createdAt,
              artifact: JSON.stringify(artifact),
            })
            broadcast({
              type: "capability-saved",
              runId,
              capabilityId: artifact.id,
            })
          },
        })
        evidence.writeResult(result)
        await completeRun(runId, result, evidence)
      } catch (err) {
        const result = {
          status: "hard_failure" as const,
          expected: "discovery completes",
          observed: err instanceof Error ? err.message : String(err),
          evidenceDir: evidence.runDir,
          durationMs: 0,
        }
        evidence.writeResult(result)
        await completeRun(runId, result, evidence)
      }
    })()
    return json(c, 202, { runId })
  })

  app.post("/replay", replayBody, async (c) => {
    const body = c.req.valid("json")
    const row = getCapability(db, body.capabilityId)
    if (!row) return json(c, 404, { error: "capability not found" })
    // Approval tokens are scoped: approved + this capability + unused.
    let approved = false
    let approvalInterventionId: string | undefined
    if (body.approvalToken) {
      const check = checkApprovalToken(body.capabilityId, body.approvalToken)
      if (!check.ok) return json(c, 403, { error: check.error })
      approved = true
      approvalInterventionId = check.intervention.id
    }
    const runId = randomUUID()
    const { evidence, session } = await prepareRun({
      runId,
      kind: "replay",
      capabilityId: body.capabilityId,
      goal: null,
      targetUrl: null,
    })
    if (!session) throw new Error("live session was not created")
    launchReplayRun({
      runId,
      capabilityRow: row,
      inputs: body.inputs ?? {},
      approved,
      approvalInterventionId,
      evidence,
      session,
    })
    return json(c, 202, { runId })
  })

  app.get("/runs", (c) => json(c, 200, listRuns(db)))

  app.get("/runs/:id", (c) => {
    const row = getRun(db, c.req.param("id"))
    return row ? json(c, 200, row) : json(c, 404, { error: "run not found" })
  })

  app.get("/runs/:id/evidence", (c) => {
    const row = getRun(db, c.req.param("id"))
    if (!row || !row.evidenceDir) {
      return json(c, 404, { error: "run or evidence not found" })
    }
    const stepsPath = join(row.evidenceDir, "steps.jsonl")
    const steps = existsSync(stepsPath)
      ? readFileSync(stepsPath, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : []
    return json(c, 200, { runId: row.id, steps })
  })

  app.get("/approvals", (c) => json(c, 200, listInterventions(db)))

  // Request-first approval (D-046): the requester raises an
  // operator-decidable record BEFORE anything risky executes. The run
  // row exists immediately (status "awaiting_approval"); approval
  // starts it, rejection stops it.
  app.post("/approvals", approvalRequestBody, async (c) => {
    const body = c.req.valid("json")
    const row = getCapability(db, body.capabilityId)
    if (!row) return json(c, 404, { error: "capability not found" })
    if (row.risk !== "risky") {
      return json(c, 400, {
        error: `capability "${body.capabilityId}" is ${row.risk} — approval is only required for risky capabilities`,
      })
    }
    const artifact = CapabilityArtifactSchema.parse(JSON.parse(row.artifact))
    // Reject malformed inputs now, not after a human spent a decision.
    const inputs = validateInputs(artifact, body.inputs ?? {})
    // Review gate lives here too: no approval request for an artifact a
    // reviewer has not signed off (replay enforces the same gate at
    // execution; without it here, approving would start a run that
    // instantly fails closed).
    if (policy.requireReviewForRisky && !artifact.reviewed) {
      return json(c, 409, {
        error: `risky capability "${body.capabilityId}" is not reviewed — a reviewer must mark it reviewed before it can be approved or executed`,
      })
    }
    const runId = randomUUID()
    await prepareRun({
      runId,
      kind: "replay",
      capabilityId: body.capabilityId,
      goal: null,
      targetUrl: null,
      status: "awaiting_approval",
      withSession: false,
    })
    const interventionId = randomUUID()
    insertIntervention(db, {
      id: interventionId,
      runId,
      kind: "approval",
      status: "pending",
      reason:
        body.reason ??
        `capability "${body.capabilityId}" is risky and requires operator approval`,
      context: JSON.stringify({
        capabilityId: body.capabilityId,
        // Pin the EXACT artifact the operator is asked to approve: the
        // run later executes this version + hash, never a mutable latest.
        artifactVersion: row.version,
        artifactHash: hashCapabilityRow(row),
        inputs,
        source: "request",
      }),
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      requestedBy: body.requestedBy,
      decidedBy: null,
      decisionReason: null,
      approvalToken: null,
      consumedByRunId: null,
    })
    broadcast({
      type: "intervention-requested",
      runId,
      interventionId,
      kind: "approval",
    })
    // The run waits; its evidence writer stays registered so the
    // decision + any later human actions land in its log.
    return json(c, 201, { id: interventionId, runId })
  })

  app.get("/approvals/:id", (c) => {
    const row = getIntervention(db, c.req.param("id"))
    return row
      ? json(c, 200, row)
      : json(c, 404, { error: "intervention not found" })
  })

  app.post("/approvals/:id/approve", decisionBody, async (c) => {
    const body = c.req.valid("json")
    const row = getIntervention(db, c.req.param("id"))
    if (!row) return json(c, 404, { error: "intervention not found" })
    if (row.status !== "pending") {
      return json(c, 409, {
        error: `intervention is already ${row.status}`,
      })
    }
    if (row.kind !== "approval") {
      return json(c, 400, {
        error: `intervention kind "${row.kind}" is not decidable here`,
      })
    }
    // Segregation metadata: same-person decisions are recorded and
    // flagged, not blocked (single-account demos stay possible; the
    // evidence says who decided — see NOTES).
    const selfApproved =
      row.requestedBy !== null && row.requestedBy === body.decidedBy

    // Auto-start the approved run. Request-first approvals already have
    // their run row (awaiting_approval); engine fail-fast approvals
    // launch a fresh run with the original inputs.
    const context = JSON.parse(row.context) as {
      capabilityId?: string
      artifactVersion?: string
      artifactHash?: string
      inputs?: ReplayInputs
    }

    // The approval is pinned to the artifact the request carried: resolve
    // that exact version and verify its content hash BEFORE deciding
    // anything, so an operator never approves a run of a mutated or
    // replaced artifact. (Approvals recorded before pinning land here
    // without a hash and fall back to the latest version.)
    let capabilityRow: CapabilityRow | undefined
    if (context.capabilityId) {
      capabilityRow = context.artifactVersion
        ? getCapabilityVersion(
            db,
            context.capabilityId,
            context.artifactVersion
          )
        : getCapability(db, context.capabilityId)
      if (!capabilityRow) {
        return json(c, 409, {
          error: `pinned artifact ${context.capabilityId}@${context.artifactVersion ?? "latest"} is no longer stored — re-request approval`,
        })
      }
      if (
        context.artifactHash &&
        hashCapabilityRow(capabilityRow) !== context.artifactHash
      ) {
        return json(c, 409, {
          error: `pinned artifact ${context.capabilityId}@${context.artifactVersion} changed since the approval was requested — re-request approval`,
        })
      }
    }

    // Token consumption is atomic with the decision: the conditional
    // UPDATE wins exactly once, so two approvals (or an approval racing a
    // token replay) cannot both start a run off the same token.
    if (row.approvalToken && !consumeApprovalToken(db, row.id, row.id)) {
      return json(c, 409, {
        error: "approval token was already consumed — the run already started",
      })
    }
    const token = randomUUID()
    resolveIntervention(db, row.id, "approved", {
      decidedBy: body.decidedBy,
      decisionReason: body.reason,
      approvalToken: token,
    })
    mergeInterventionContext(db, row.id, { selfApproved })

    let executionRunId: string | null = null
    if (context.capabilityId && capabilityRow) {
      const existingRun = row.runId ? getRun(db, row.runId) : undefined
      if (existingRun && existingRun.status === "awaiting_approval") {
        const session = await createLiveSession(
          await getBrowser(),
          existingRun.id
        )
        const evidence = createEvidenceWriter(evidenceDir, existingRun.id)
        activeEvidence.set(existingRun.id, evidence)
        setRunStatus(db, existingRun.id, "running")
        executionRunId = existingRun.id
        launchReplayRun({
          runId: existingRun.id,
          capabilityRow,
          inputs: context.inputs ?? {},
          approved: true,
          approvalInterventionId: row.id,
          evidence,
          session,
        })
      } else {
        const newRunId = randomUUID()
        const { evidence, session } = await prepareRun({
          runId: newRunId,
          kind: "replay",
          capabilityId: context.capabilityId,
          goal: null,
          targetUrl: null,
        })
        if (!session) throw new Error("live session was not created")
        executionRunId = newRunId
        launchReplayRun({
          runId: newRunId,
          capabilityRow,
          inputs: context.inputs ?? {},
          approved: true,
          approvalInterventionId: row.id,
          evidence,
          session,
        })
      }
      mergeInterventionContext(db, row.id, {
        executionRunId,
      })
      activeEvidence.get(executionRunId)?.logStep({
        runId: executionRunId,
        stepIndex: -1,
        at: new Date().toISOString(),
        action: "approval",
        reason: `approved by ${body.decidedBy}${selfApproved ? " (self-approved — requester and decider coincide)" : ""}${body.reason ? ` — ${body.reason}` : ""}; run started on pinned artifact ${context.artifactVersion ?? capabilityRow.version}`,
        durationMs: 0,
        result: "ok",
      })
    }
    broadcast({
      type: "intervention-resolved",
      interventionId: row.id,
      runId: executionRunId,
      status: "approved",
      decidedBy: body.decidedBy,
      selfApproved,
    })
    return json(c, 200, {
      id: row.id,
      runId: executionRunId,
      selfApproved,
    })
  })

  app.post("/approvals/:id/reject", decisionBody, async (c) => {
    const body = c.req.valid("json")
    const row = getIntervention(db, c.req.param("id"))
    if (!row) return json(c, 404, { error: "intervention not found" })
    if (row.status !== "pending") {
      return json(c, 409, {
        error: `intervention is already ${row.status}`,
      })
    }
    const selfApproved =
      row.requestedBy !== null && row.requestedBy === body.decidedBy
    resolveIntervention(db, row.id, "rejected", {
      decidedBy: body.decidedBy,
      decisionReason: body.reason,
    })
    mergeInterventionContext(db, row.id, { selfApproved })
    // A request-first run never executes: it stops where it waited.
    if (row.runId) {
      const run = getRun(db, row.runId)
      if (run && run.status === "awaiting_approval") {
        activeEvidence.get(row.runId)?.logStep({
          runId: row.runId,
          stepIndex: -1,
          at: new Date().toISOString(),
          action: "approval",
          reason: `rejected by ${body.decidedBy}${selfApproved ? " (self-approved — requester and decider coincide)" : ""}${body.reason ? ` — ${body.reason}` : ""}; run stopped without executing`,
          durationMs: 0,
          result: "skipped",
        })
        setRunStatus(db, row.runId, "stopped")
        activeEvidence.delete(row.runId)
        const session = getSession(row.runId)
        if (session) await closeLiveSession(row.runId)
        broadcast({ type: "run-finished", runId: row.runId, result: null })
      }
    }
    broadcast({
      type: "intervention-resolved",
      interventionId: row.id,
      runId: row.runId,
      status: "rejected",
      decidedBy: body.decidedBy,
      selfApproved,
    })
    return json(c, 200, { id: row.id, status: "rejected", selfApproved })
  })

  const getSessionState = async (
    c: Context,
    runId: string
  ): Promise<Response> => {
    const state = await sessionState(runId)
    return state
      ? json(c, 200, state)
      : json(c, 404, {
          error: "no live session for this run (finished runs close it)",
        })
  }
  // The frontend client reads the /state suffix; the unsuffixed alias keeps
  // the route shape the hand-rolled server answered.
  app.get("/sessions/:runId/state", (c) =>
    getSessionState(c, c.req.param("runId"))
  )
  app.get("/sessions/:runId", (c) => getSessionState(c, c.req.param("runId")))

  const postSessionAction = async (
    c: Context,
    runId: string,
    body: z.infer<typeof sessionActionBodySchema>
  ): Promise<Response> => {
    const result = await executeHumanAction(runId, body)
    if (!result.ok) {
      const state = await sessionState(runId)
      return json(c, 409, { error: result.error, state })
    }
    return json(c, 200, {
      detail: result.detail,
      state: await sessionState(runId),
    })
  }
  app.post("/sessions/:runId/action", sessionActionBody, (c) =>
    postSessionAction(c, c.req.param("runId"), c.req.valid("json"))
  )
  app.post("/sessions/:runId", sessionActionBody, (c) =>
    postSessionAction(c, c.req.param("runId"), c.req.valid("json"))
  )

  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen: (_event, ws) => {
        wsClients.add(ws)
        ws.send(
          JSON.stringify({
            type: "hello",
            service: "engine",
            sessions: listSessions(),
          })
        )
      },
      onMessage: (event) => {
        // Control channel: pause / cede / resume / human-action.
        try {
          const text =
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data)
          // Validate at the boundary — the control channel drives session
          // ownership, so a malformed or type-confused frame must be dropped,
          // never coerced. Mirrors the frontend ControlCommand contract
          // (apps/frontend/lib/engine/ws.ts); unknown frames are ignored.
          const parsed = wsControlMessageSchema.safeParse(JSON.parse(text))
          if (!parsed.success) return
          const msg = parsed.data
          if (msg.type === "pause") {
            const ok = pauseSession(msg.runId)
            broadcastControlState(msg.runId, ok)
            return
          }
          if (msg.type === "cede") {
            const ok = cedeSession(msg.runId, msg.operator ?? "operator")
            broadcastControlState(msg.runId, ok)
            return
          }
          if (msg.type === "resume") {
            const ok = resumeSession(msg.runId, msg.operator)
            broadcastControlState(msg.runId, ok)
            if (ok) {
              // Resuming answers any pending stuck intervention for this run:
              // the operator took over and handed control back.
              for (const intervention of listInterventions(db, "pending")) {
                if (
                  intervention.runId === msg.runId &&
                  intervention.kind === "stuck"
                ) {
                  resolveIntervention(db, intervention.id, "resolved", {
                    decidedBy: msg.operator ?? "operator",
                    decisionReason:
                      msg.detail ?? "operator returned control to automation",
                  })
                  broadcast({
                    type: "intervention-resolved",
                    interventionId: intervention.id,
                    runId: msg.runId,
                    status: "resolved",
                    decidedBy: msg.operator ?? "operator",
                  })
                }
              }
            }
            return
          }
          if (msg.type === "human-action" && msg.detail) {
            recordHumanAction(msg.runId, msg.detail)
            activeEvidence.get(msg.runId)?.logStep({
              runId: msg.runId,
              stepIndex: -1,
              at: new Date().toISOString(),
              action: "human-action",
              reason: msg.detail,
              durationMs: 0,
              result: "ok",
            })
            broadcast({
              type: "human-action",
              runId: msg.runId,
              detail: msg.detail,
            })
            return
          }
        } catch {
          // Malformed WS messages are ignored; the channel stays open.
        }
      },
      onClose: (_event, ws) => {
        wsClients.delete(ws)
      },
    }))
  )

  const wss = new WebSocketServer({ noServer: true })
  const httpServer = serve(
    {
      fetch: app.fetch,
      port: options.port,
      websocket: { server: wss },
    },
    () => {
      console.log(`engine server listening on http://localhost:${options.port}`)
    }
  )

  return { httpServer, wss, getBrowser }
}
