/**
 * Live-session control model (assignment §3.6): the seam that lets a human
 * take over THE SAME browser session the automation was using.
 *
 * A `LiveSession` wraps one Playwright browser context + page with an
 * explicit ownership state machine:
 *
 *   automation ──cede──▶ human ──resume──▶ automation
 *        │                                     ▲
 *        └──────────── pause ──────────────────┘
 *
 * - `pause`    automation stops issuing actions (control stays "automation")
 * - `cede`     control passes to a human operator; automation blocks
 * - `resume`   control returns; automation continues
 *
 * Runs that may need handoff await `waitWhileNotAutomation()` before each
 * action. The WebSocket channel (server.ts) carries these messages; this
 * module owns the state.
 */
import { EventEmitter } from "node:events"
import type { Browser, BrowserContext, Page } from "playwright"

export type ControlOwner = "automation" | "human"

let ownershipEpoch = 0

export type LiveSession = {
  id: string
  runId: string
  context: BrowserContext
  page: Page
  owner: ControlOwner
  paused: boolean
  /** Incremented on every ownership change; automation must abort if it changes mid-action. */
  epoch: number
  /** Append-only record of who did what, for evidence. */
  controlLog: Array<{ at: string; event: string; detail?: string }>
  emitter: EventEmitter
  signal: () => void
}

const sessions = new Map<string, LiveSession>()

export const createLiveSession = async (
  browser: Browser,
  runId: string
): Promise<LiveSession> => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const emitter = new EventEmitter()
  const session: LiveSession = {
    id: runId,
    runId,
    context,
    page,
    owner: "automation",
    paused: false,
    epoch: ownershipEpoch,
    controlLog: [{ at: new Date().toISOString(), event: "session-opened" }],
    emitter,
    signal: () => emitter.emit("change"),
  }
  sessions.set(runId, session)
  return session
}

export const getSession = (runId: string): LiveSession | undefined =>
  sessions.get(runId)

export const closeLiveSession = async (runId: string): Promise<void> => {
  const s = sessions.get(runId)
  if (!s) return
  s.controlLog.push({ at: new Date().toISOString(), event: "session-closed" })
  sessions.delete(runId)
  await s.context.close().catch(() => undefined)
}

/** Automation must call this before every action; it blocks while paused or human-owned. */
export const waitWhileNotAutomation = (session: LiveSession): Promise<void> =>
  new Promise((resolve) => {
    const check = () => {
      if (session.owner === "automation" && !session.paused) {
        session.emitter.off("change", check)
        resolve()
      }
    }
    session.emitter.on("change", check)
    check()
  })

/**
 * Block until automation owns the session again (a stuck run waiting for an
 * operator), or until `timeoutMs` elapses. "resumed" means a human handed
 * control back; "timeout" means nobody answered the handoff in time.
 */
export const waitForAutomation = (
  session: LiveSession,
  timeoutMs: number
): Promise<"resumed" | "timeout"> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      session.emitter.off("change", check)
      resolve("timeout")
    }, timeoutMs)
    const check = () => {
      if (session.owner === "automation" && !session.paused) {
        clearTimeout(timer)
        session.emitter.off("change", check)
        resolve("resumed")
      }
    }
    session.emitter.on("change", check)
    check()
  })

/** Summary of every live session, for the WS hello + debugging. */
export const listSessions = (): Array<{
  runId: string
  owner: ControlOwner
  paused: boolean
  /** Incremented on every ownership change; automation must abort if it changes mid-action. */
  epoch: number
}> =>
  [...sessions.values()].map((s) => ({
    runId: s.runId,
    owner: s.owner,
    paused: s.paused,
    epoch: s.epoch,
  }))

export const pauseSession = (runId: string): boolean => {
  const s = sessions.get(runId)
  if (!s || s.paused) return false
  s.paused = true
  s.controlLog.push({ at: new Date().toISOString(), event: "paused" })
  s.signal()
  return true
}

export const cedeSession = (runId: string, operator: string): boolean => {
  const s = sessions.get(runId)
  if (!s || s.owner === "human") return false
  s.owner = "human"
  s.epoch = ++ownershipEpoch
  s.controlLog.push({
    at: new Date().toISOString(),
    event: "ceded",
    detail: `control ceded to ${operator}`,
  })
  s.signal()
  return true
}

export const resumeSession = (runId: string, operator?: string): boolean => {
  const s = sessions.get(runId)
  if (!s) return false
  const wasHuman = s.owner === "human"
  s.owner = "automation"
  s.epoch = ++ownershipEpoch
  s.paused = false
  s.controlLog.push({
    at: new Date().toISOString(),
    event: "resumed",
    detail: operator ? `control returned by ${operator}` : "resumed",
  })
  s.signal()
  return wasHuman || true
}

/** Record a manual action the operator performed during handoff. */
export const recordHumanAction = (runId: string, detail: string): void => {
  const s = sessions.get(runId)
  if (!s) return
  s.controlLog.push({
    at: new Date().toISOString(),
    event: "human-action",
    detail,
  })
  s.signal()
}
