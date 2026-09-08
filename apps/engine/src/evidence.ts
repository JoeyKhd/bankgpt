/**
 * Evidence & observability (assignment §3.5).
 *
 * Every run (discovery or replay) produces:
 * - a structured, per-step JSONL log: action, target, the model's/recorded
 *   REASON, duration, and result — enough to replay the decision trail, and
 * - richer failure signals: a screenshot + aria snapshot on every failure,
 *   plus the full model transcript for discovery runs.
 *
 * Everything written passes through policy redaction first. Evidence files
 * live under `<evidenceDir>/runs/<runId>/`:
 *   steps.jsonl        one redacted JSON object per step
 *   transcript.json    full model transcript (discovery only, redacted)
 *   result.json        final structured run result (redacted)
 *   failure-step-N.png screenshot captured when step N failed
 *   failure-step-N.yml aria snapshot captured when step N failed
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs"
import { join } from "node:path"
import { redactValue, redactText } from "./policy.js"

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
 * Append-only evidence writer for one run. Construct once per run; call
 * `logStep` as steps complete and `writeArtifact`/`writeResult` at the end.
 */
export const createEvidenceWriter = (evidenceDir: string, runId: string) => {
  const runDir = join(evidenceDir, "runs", runId)
  mkdirSync(runDir, { recursive: true })
  const stepsPath = join(runDir, "steps.jsonl")

  const logStep = (entry: StepEvidence): void => {
    const redacted = redactValue(entry)
    appendFileSync(stepsPath, JSON.stringify(redacted) + "\n")
  }

  /** Persist the full discovery transcript (model messages), redacted. */
  const writeTranscript = (transcript: unknown): void => {
    writeFileSync(
      join(runDir, "transcript.json"),
      JSON.stringify(redactValue(transcript), null, 2)
    )
  }

  /** Persist the final structured run result, redacted. */
  const writeResult = (result: unknown): void => {
    writeFileSync(
      join(runDir, "result.json"),
      JSON.stringify(redactValue(result), null, 2)
    )
  }

  /** Persist a richer failure signal: screenshot + aria snapshot of the page. */
  const writeFailureSnapshot = (
    stepIndex: number,
    screenshot: Buffer | undefined,
    ariaSnapshot: string | undefined
  ): void => {
    if (screenshot) {
      writeFileSync(join(runDir, `failure-step-${stepIndex}.png`), screenshot)
    }
    if (ariaSnapshot) {
      writeFileSync(
        join(runDir, `failure-step-${stepIndex}.yml`),
        redactText(ariaSnapshot)
      )
    }
  }

  return { runDir, logStep, writeTranscript, writeResult, writeFailureSnapshot }
}

export type EvidenceWriter = ReturnType<typeof createEvidenceWriter>
