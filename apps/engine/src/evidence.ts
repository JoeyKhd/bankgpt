/**
 * Evidence & observability (assignment §3.5, storage per D-059).
 *
 * Every run (discovery or replay) produces:
 * - a structured, per-step JSONL log: action, target, the model's/recorded
 *   REASON, duration, and result — enough to replay the decision trail, and
 * - richer failure signals: a screenshot + aria snapshot on every failure,
 *   plus the full model transcript for discovery runs.
 *
 * Everything written passes through policy redaction first. Evidence lives
 * in the engine's SQLite DB: one row per file in `run_files`, keyed by
 * (runId, name) — nothing touches the filesystem.
 *   steps.jsonl        one redacted JSON object per step (canonical step store)
 *   transcript.json    full model transcript (discovery only, redacted)
 *   result.json        final structured run result (redacted)
 *   control.json       session ownership log (runs with a live session)
 *   failure-step-N.png screenshot captured when step N failed
 *   failure-step-N.yml aria snapshot captured when step N failed
 *   handoff-step-N.*   the same capture when a stuck run escalates
 * Files are served back over the HTTP API at /runs/:id/files[/:name].
 */
import type Database from "better-sqlite3"
import { getRunFile, putRunFile } from "@/db"
import { redactValue, redactText } from "@/policy"

/** One structured step event in a run log. */
export type StepEvidence = {
  runId: string
  stepIndex: number
  /** Wall-clock time the step started. */
  at: string
  action: string
  /** Human-readable target summary or URL. */
  target?: string
  /** Why this step happened (model rationale or recorded intent). */
  reason: string
  durationMs: number
  result: "ok" | "failed" | "skipped"
  /** Error detail when result is "failed". */
  error?: string
}

/**
 * Evidence writer for one run. Construct once per run; call `logStep` as
 * steps complete and `writeTranscript`/`writeResult` at the end. Persists
 * to `run_files` via putRunFile.
 */
export const createEvidenceWriter = (db: Database.Database, runId: string) => {
  // Logical evidence key ("runs/<runId>"), kept for the writer's public
  // shape — it names the run's evidence set, NOT a filesystem path.
  const runDir = `runs/${runId}`

  // steps.jsonl is one blob rewritten on each logged step; the in-memory
  // buffer seeds from the stored blob so a second writer for the same run
  // (e.g. the approval-resume path) continues the log instead of
  // truncating it.
  const steps: string[] = (
    getRunFile(db, runId, "steps.jsonl")?.data.toString("utf8") ?? ""
  )
    .split("\n")
    .filter(Boolean)

  const logStep = (entry: StepEvidence): void => {
    steps.push(JSON.stringify(redactValue(entry)))
    putRunFile(
      db,
      runId,
      "steps.jsonl",
      "application/jsonl",
      Buffer.from(steps.join("\n") + "\n", "utf8")
    )
  }

  /** Persist the full discovery transcript (model messages), redacted. */
  const writeTranscript = (transcript: unknown): void => {
    putRunFile(
      db,
      runId,
      "transcript.json",
      "application/json",
      Buffer.from(JSON.stringify(redactValue(transcript), null, 2), "utf8")
    )
  }

  /** Persist the final structured run result, redacted. */
  const writeResult = (result: unknown): void => {
    putRunFile(
      db,
      runId,
      "result.json",
      "application/json",
      Buffer.from(JSON.stringify(redactValue(result), null, 2), "utf8")
    )
  }

  /** Persist a richer failure signal: screenshot + aria snapshot of the page. */
  const writeFailureSnapshot = (
    stepIndex: number,
    screenshot: Buffer | undefined,
    ariaSnapshot: string | undefined
  ): void => {
    if (screenshot) {
      putRunFile(
        db,
        runId,
        `failure-step-${stepIndex}.png`,
        "image/png",
        screenshot
      )
    }
    if (ariaSnapshot) {
      putRunFile(
        db,
        runId,
        `failure-step-${stepIndex}.yml`,
        "application/yaml",
        Buffer.from(redactText(ariaSnapshot), "utf8")
      )
    }
  }

  return { runDir, logStep, writeTranscript, writeResult, writeFailureSnapshot }
}

export type EvidenceWriter = ReturnType<typeof createEvidenceWriter>
