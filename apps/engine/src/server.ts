/**
 * Engine server (D-041): HTTP API + WebSocket control channel.
 *
 * HTTP (JSON):
 *   GET  /health
 *   GET  /capabilities
 *   GET  /capabilities/:id
 *   POST /capabilities                    save/upsert an artifact
 *   POST /capabilities/:id/review         mark reviewed:true
 *   POST /discover                        start a discovery run (async)
 *   POST /replay                          start a replay run (async)
 *   GET  /runs
 *   GET  /runs/:id                        run row + parsed result
 *   GET  /runs/:id/evidence               steps.jsonl contents
 *   GET  /approvals
 *   POST /approvals/:id/approve           approve -> issues one-time token
 *   POST /approvals/:id/reject
 *
 * WebSocket (/ws): step events stream + control channel
 * (pause/cede/resume) for the live-session handoff. The session registry
 * and control state machine are real; the operator UI lands in a later
 * phase on top of this channel.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { WebSocketServer, type WebSocket } from "ws"
import { chromium, type Browser } from "playwright"
import type Database from "better-sqlite3"
import { CapabilityArtifactSchema } from "./artifact.js"
import {
  getCapability,
  insertCapability,
  listCapabilities,
  setCapabilityReviewed,
  insertRun,
  finishRun,
  getRun,
  listRuns,
  insertIntervention,
  getIntervention,
  listInterventions,
  resolveIntervention,
  findApprovalToken,
} from "./db.js"
import { runDiscovery } from "./discovery.js"
import { replayCapability } from "./replay.js"
import { defaultPolicy, redactValue, type Policy } from "./policy.js"
import { createEvidenceWriter } from "./evidence.js"
import {
  pauseSession,
  cedeSession,
  resumeSession,
  getSession,
} from "./session.js"

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

const json = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(redactValue(body)))
}

const readBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let data = ""
    req.on("data", (chunk: Buffer) => (data += chunk.toString()))
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on("error", reject)
  })

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

  const wsClients = new Set<WebSocket>()
  const broadcast = (event: unknown): void => {
    const payload = JSON.stringify(redactValue(event))
    for (const client of wsClients) {
      if (client.readyState === client.OPEN) client.send(payload)
    }
  }

  const handleRequest = async (
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> => {
    const url = new URL(req.url ?? "/", `http://localhost:${options.port}`)
    const parts = url.pathname.split("/").filter(Boolean)
    const method = req.method ?? "GET"

    try {
      if (method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true, service: "engine" })
      }

      if (method === "GET" && url.pathname === "/capabilities") {
        return json(res, 200, listCapabilities(db))
      }
      if (
        method === "GET" &&
        parts[0] === "capabilities" &&
        parts.length === 2
      ) {
        const row = getCapability(db, parts[1]!)
        return row
          ? json(res, 200, { ...row, artifact: JSON.parse(row.artifact) })
          : json(res, 404, { error: "capability not found" })
      }
      if (method === "POST" && url.pathname === "/capabilities") {
        const body = await readBody(req)
        const artifact = CapabilityArtifactSchema.parse(body)
        insertCapability(db, {
          id: artifact.id,
          version: artifact.version,
          name: artifact.name,
          risk: artifact.risk,
          reviewed: artifact.reviewed ? 1 : 0,
          createdAt: artifact.createdAt,
          artifact: JSON.stringify(artifact),
        })
        return json(res, 201, { id: artifact.id, version: artifact.version })
      }
      if (
        method === "POST" &&
        parts[0] === "capabilities" &&
        parts[2] === "review"
      ) {
        const row = getCapability(db, parts[1]!)
        if (!row) return json(res, 404, { error: "capability not found" })
        setCapabilityReviewed(db, parts[1]!, true)
        return json(res, 200, { id: parts[1], reviewed: true })
      }

      if (method === "POST" && url.pathname === "/discover") {
        const body = (await readBody(req)) as {
          goal?: string
          targetUrl?: string
          model?: string
        }
        if (!body.goal || !body.targetUrl) {
          return json(res, 400, { error: "goal and targetUrl are required" })
        }
        const runId = randomUUID()
        const evidence = createEvidenceWriter(evidenceDir, runId)
        insertRun(db, {
          id: runId,
          kind: "discovery",
          capabilityId: null,
          status: "running",
          goal: body.goal,
          targetUrl: body.targetUrl,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          result: null,
          evidenceDir: evidence.runDir,
        })
        // Runs async; clients follow progress on the WS channel or poll /runs/:id.
        void (async () => {
          try {
            const result = await runDiscovery({
              goal: body.goal!,
              targetUrl: body.targetUrl!,
              policy,
              evidence,
              runId,
              model: body.model ?? discoveryModel,
              apiKey,
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
            finishRun(db, runId, result.status, JSON.stringify(result))
            broadcast({ type: "run-finished", runId, result })
          } catch (err) {
            const result = {
              status: "hard_failure" as const,
              expected: "discovery completes",
              observed: err instanceof Error ? err.message : String(err),
              evidenceDir: evidence.runDir,
              durationMs: 0,
            }
            evidence.writeResult(result)
            finishRun(db, runId, "hard_failure", JSON.stringify(result))
            broadcast({ type: "run-finished", runId, result })
          }
        })()
        return json(res, 202, { runId })
      }

      if (method === "POST" && url.pathname === "/replay") {
        const body = (await readBody(req)) as {
          capabilityId?: string
          inputs?: Record<string, string | number | boolean>
          approvalToken?: string
        }
        if (!body.capabilityId) {
          return json(res, 400, { error: "capabilityId is required" })
        }
        const row = getCapability(db, body.capabilityId)
        if (!row) return json(res, 404, { error: "capability not found" })
        const runId = randomUUID()
        const evidence = createEvidenceWriter(evidenceDir, runId)
        insertRun(db, {
          id: runId,
          kind: "replay",
          capabilityId: body.capabilityId,
          status: "running",
          goal: null,
          targetUrl: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          result: null,
          evidenceDir: evidence.runDir,
        })
        void (async () => {
          try {
            const approved = body.approvalToken
              ? findApprovalToken(db, runId, body.approvalToken) !==
                  undefined ||
                // Token may have been issued for an earlier blocked attempt of
                // the same capability; accept any approved token row.
                listInterventions(db, "approved").some(
                  (i) => i.approvalToken === body.approvalToken
                )
              : false
            const browser = await getBrowser()
            const result = await replayCapability({
              browser,
              artifact: JSON.parse(row.artifact),
              inputs: body.inputs ?? {},
              policy,
              evidence,
              runId,
              approved,
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
            finishRun(db, runId, result.status, JSON.stringify(result))
            // A risky run without approval raises an intervention request.
            if (
              result.status === "hard_failure" &&
              result.observed.includes("approval required")
            ) {
              const interventionId = randomUUID()
              insertIntervention(db, {
                id: interventionId,
                runId,
                kind: "approval",
                status: "pending",
                reason: result.observed,
                context: JSON.stringify({ capabilityId: body.capabilityId }),
                createdAt: new Date().toISOString(),
                resolvedAt: null,
                approvalToken: null,
              })
              broadcast({
                type: "intervention-requested",
                runId,
                interventionId,
              })
            }
            broadcast({ type: "run-finished", runId, result })
          } catch (err) {
            const result = {
              status: "hard_failure" as const,
              capabilityId: body.capabilityId,
              expected: "replay completes",
              observed: err instanceof Error ? err.message : String(err),
              evidenceDir: evidence.runDir,
              durationMs: 0,
            }
            evidence.writeResult(result)
            finishRun(db, runId, "hard_failure", JSON.stringify(result))
            broadcast({ type: "run-finished", runId, result })
          }
        })()
        return json(res, 202, { runId })
      }

      if (method === "GET" && url.pathname === "/runs") {
        return json(res, 200, listRuns(db))
      }
      if (method === "GET" && parts[0] === "runs" && parts.length === 2) {
        const row = getRun(db, parts[1]!)
        return row
          ? json(res, 200, {
              ...row,
              result: row.result ? JSON.parse(row.result) : null,
            })
          : json(res, 404, { error: "run not found" })
      }
      if (method === "GET" && parts[0] === "runs" && parts[2] === "evidence") {
        const row = getRun(db, parts[1]!)
        if (!row || !row.evidenceDir) {
          return json(res, 404, { error: "run or evidence not found" })
        }
        const stepsPath = join(row.evidenceDir, "steps.jsonl")
        const steps = existsSync(stepsPath)
          ? readFileSync(stepsPath, "utf8")
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line))
          : []
        return json(res, 200, { runId: row.id, steps })
      }

      if (method === "GET" && url.pathname === "/approvals") {
        return json(res, 200, listInterventions(db))
      }
      if (
        method === "POST" &&
        parts[0] === "approvals" &&
        parts[2] === "approve"
      ) {
        const row = getIntervention(db, parts[1]!)
        if (!row) return json(res, 404, { error: "intervention not found" })
        const token = randomUUID()
        resolveIntervention(db, parts[1]!, "approved", token)
        return json(res, 200, { id: parts[1], approvalToken: token })
      }
      if (
        method === "POST" &&
        parts[0] === "approvals" &&
        parts[2] === "reject"
      ) {
        const row = getIntervention(db, parts[1]!)
        if (!row) return json(res, 404, { error: "intervention not found" })
        resolveIntervention(db, parts[1]!, "rejected")
        return json(res, 200, { id: parts[1], status: "rejected" })
      }

      return json(res, 404, { error: "not found" })
    } catch (err) {
      return json(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const httpServer = createServer((req, res) => {
    void handleRequest(req, res)
  })

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" })
  wss.on("connection", (socket) => {
    wsClients.add(socket)
    socket.send(
      JSON.stringify({ type: "hello", service: "engine", sessions: [] })
    )
    socket.on("message", (data) => {
      // Control channel: pause / cede / resume / human-action.
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string
          runId?: string
          operator?: string
          detail?: string
        }
        if (!msg.runId) return
        let ok = false
        if (msg.type === "pause") ok = pauseSession(msg.runId)
        if (msg.type === "cede")
          ok = cedeSession(msg.runId, msg.operator ?? "operator")
        if (msg.type === "resume") ok = resumeSession(msg.runId, msg.operator)
        const session = getSession(msg.runId)
        broadcast({
          type: "control-state",
          runId: msg.runId,
          applied: ok,
          owner: session?.owner ?? "automation",
          paused: session?.paused ?? false,
        })
      } catch {
        // Malformed WS messages are ignored; the channel stays open.
      }
    })
    socket.on("close", () => wsClients.delete(socket))
  })

  httpServer.listen(options.port, () => {
    console.log(`engine server listening on http://localhost:${options.port}`)
  })

  return { httpServer, wss, getBrowser }
}
