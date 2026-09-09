"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"

import {
  EngineErrorBanner,
  EngineOfflineBanner,
  EmptyState,
  EvidenceResultPill,
  KindPill,
  LoadingRows,
  RunStatusPill,
  Section,
  formatDateTime,
  formatDurationMs,
  monoEyebrow,
  runDuration,
} from "@/components/admin/engine-ui"
import {
  engineErrorMessage,
  isEngineOffline,
  runEvidenceQuery,
  runQuery,
  type EngineRunResult,
  type RunStatus,
  type StepEvidence,
} from "@/lib/engine"

// ── Structured result panel ──────────────────────────────────────────────

const KeyValue = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-2 text-xs">
    <span className="w-28 shrink-0 font-mono text-muted-foreground/70">
      {label}
    </span>
    <span className="break-all text-foreground/90">{value}</span>
  </div>
)

const RunResultPanel = ({ result }: { result: EngineRunResult }) => {
  switch (result.status) {
    case "success":
      // Replay success carries outputs; discovery success carries a goal.
      if ("outputs" in result) {
        const entries = Object.entries(result.outputs)
        return (
          <Section eyebrow="Result · success">
            <div className="flex flex-col gap-1.5">
              <KeyValue label="capability" value={result.capabilityId} />
              <KeyValue
                label="steps executed"
                value={String(result.stepsExecuted)}
              />
              <KeyValue
                label="duration"
                value={formatDurationMs(result.durationMs)}
              />
            </div>
            {entries.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-white/6 pt-3">
                <span className={monoEyebrow}>Outputs</span>
                {entries.map(([name, value]) => (
                  <KeyValue key={name} label={name} value={String(value)} />
                ))}
              </div>
            )}
          </Section>
        )
      }
      return (
        <Section eyebrow="Result · discovery succeeded">
          <div className="flex flex-col gap-1.5">
            <KeyValue label="goal" value={result.goal} />
            <KeyValue
              label="steps executed"
              value={String(result.stepsExecuted)}
            />
            <KeyValue
              label="duration"
              value={formatDurationMs(result.durationMs)}
            />
            {result.capabilityId && (
              <div className="flex items-baseline gap-2 text-xs">
                <span className="w-28 shrink-0 font-mono text-muted-foreground/70">
                  saved as
                </span>
                <Link
                  href={`/admin/capabilities/${encodeURIComponent(result.capabilityId)}`}
                  className="font-mono text-emerald-300 hover:underline"
                >
                  {result.capabilityId}
                </Link>
              </div>
            )}
          </div>
        </Section>
      )
    case "business_outcome":
      return (
        <Section eyebrow="Result · expected business outcome">
          <div className="flex flex-col gap-1.5">
            <KeyValue label="outcome" value={result.outcome} />
            <KeyValue label="detail" value={result.detail} />
            <KeyValue
              label="steps executed"
              value={String(result.stepsExecuted)}
            />
            <KeyValue
              label="duration"
              value={formatDurationMs(result.durationMs)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A legitimate answer the capability was designed to detect — not a
            crash.
          </p>
        </Section>
      )
    case "recoverable":
      return (
        <Section eyebrow="Result · recoverable">
          <div className="flex flex-col gap-1.5">
            <KeyValue label="condition" value={result.condition} />
            <KeyValue label="failed step" value={String(result.step)} />
            <KeyValue
              label="retries"
              value={`${result.retryPolicy.attempts} attempts over ${formatDurationMs(result.retryPolicy.waitedMs)}`}
            />
            <KeyValue label="detail" value={result.detail} />
            <KeyValue
              label="duration"
              value={formatDurationMs(result.durationMs)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A known transient condition — surfaced after retries were exhausted.
            Replaying usually works.
          </p>
        </Section>
      )
    case "hard_failure":
      return (
        <Section eyebrow="Result · hard failure">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-xl border border-white/6 bg-white/[0.02] p-3">
              <span className="font-mono text-xs font-medium tracking-[0.14em] text-emerald-300/80 uppercase">
                Expected
              </span>
              <span className="text-sm">{result.expected}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3">
              <span className="font-mono text-xs font-medium tracking-[0.14em] text-red-300/80 uppercase">
                Observed
              </span>
              <span className="text-sm">{result.observed}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {result.step !== undefined && (
              <KeyValue label="failed step" value={String(result.step)} />
            )}
            <KeyValue
              label="duration"
              value={formatDurationMs(result.durationMs)}
            />
            {result.evidenceDir && (
              <KeyValue label="evidence dir" value={result.evidenceDir} />
            )}
          </div>
          {result.evidenceDir && (
            <p className="text-xs text-muted-foreground">
              Failure screenshots and snapshots are written to the evidence
              directory on the engine host.
            </p>
          )}
        </Section>
      )
    case "stuck":
      return (
        <Section eyebrow="Result · discovery stuck">
          <div className="flex flex-col gap-1.5">
            <KeyValue label="goal" value={result.goal} />
            <KeyValue label="reason" value={result.reason} />
            <KeyValue label="at step" value={String(result.step)} />
            <KeyValue
              label="duration"
              value={formatDurationMs(result.durationMs)}
            />
          </div>
        </Section>
      )
    case "stopped":
      return (
        <Section eyebrow="Result · discovery stopped">
          <div className="flex flex-col gap-1.5">
            <KeyValue label="goal" value={result.goal} />
            <KeyValue label="reason" value={result.reason} />
            <KeyValue
              label="steps executed"
              value={String(result.stepsExecuted)}
            />
            <KeyValue
              label="duration"
              value={formatDurationMs(result.durationMs)}
            />
          </div>
        </Section>
      )
  }
}

// ── Step evidence ────────────────────────────────────────────────────────

const EvidenceStepRow = ({ step }: { step: StepEvidence }) => (
  <li className="flex flex-col gap-1.5 rounded-xl border border-white/6 bg-white/[0.02] p-4">
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.05] font-mono text-xs text-muted-foreground">
        {step.stepIndex}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-xs text-muted-foreground">
        {step.action}
      </span>
      {step.target && (
        <span className="font-mono text-xs break-all text-foreground/80">
          {step.target}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground/70">
          {formatDurationMs(step.durationMs)}
        </span>
        <EvidenceResultPill result={step.result} />
      </span>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">
      {step.reason}
    </p>
    {step.error && (
      <p className="rounded-lg border border-red-400/20 bg-red-400/[0.05] px-2.5 py-1.5 font-mono text-xs break-all text-red-200">
        {step.error}
      </p>
    )}
  </li>
)

// ── Page body ────────────────────────────────────────────────────────────

export const RunDetail = ({ runId }: { runId: string }) => {
  const run = useQuery(runQuery(runId))
  const evidence = useQuery(runEvidenceQuery(runId))

  // The evidence endpoint is append-only and does not poll on its own; the
  // run query polls every 2s while running, so refetch evidence each time
  // the run row updates — steps stream in as they land. One final refetch
  // fires on the running -> finished transition so the last steps and the
  // terminal state are never missed.
  const refetchEvidence = evidence.refetch
  const runUpdatedAt = run.dataUpdatedAt
  const runStatus = run.data?.status
  const prevStatus = useRef<RunStatus | undefined>(undefined)
  const isRunning = runStatus === "running"
  useEffect(() => {
    const wasRunning = prevStatus.current === "running"
    if (isRunning || wasRunning) {
      refetchEvidence()
    }
    prevStatus.current = runStatus
  }, [runUpdatedAt, runStatus, isRunning, refetchEvidence])

  if (run.isPending) {
    return (
      <div className="flex flex-col gap-8">
        <DetailHeader />
        <LoadingRows rows={3} />
      </div>
    )
  }

  if (run.isError) {
    return (
      <div className="flex flex-col gap-8">
        <DetailHeader />
        {isEngineOffline(run.error) ? (
          <EngineOfflineBanner reason={engineErrorMessage(run.error)} />
        ) : (
          <EngineErrorBanner reason={engineErrorMessage(run.error)} />
        )}
      </div>
    )
  }

  const runData = run.data
  const steps = evidence.data
    ? [...evidence.data.steps].sort((a, b) => a.stepIndex - b.stepIndex)
    : []

  return (
    <div className="flex flex-col gap-8">
      <DetailHeader />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <KindPill kind={runData.kind} />
          <RunStatusPill status={runData.status} />
          <span className="font-mono text-xs text-muted-foreground">
            {runData.id}
          </span>
        </div>
        {runData.goal && (
          <p className="max-w-3xl text-sm leading-relaxed">
            Goal: {runData.goal}
          </p>
        )}
        <div className="grid gap-x-8 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          {runData.capabilityId && (
            <span>
              Capability:{" "}
              <Link
                href={`/admin/capabilities/${encodeURIComponent(runData.capabilityId)}`}
                className="font-mono text-emerald-300 hover:underline"
              >
                {runData.capabilityId}
              </Link>
            </span>
          )}
          {runData.targetUrl && (
            <span className="break-all">
              Target:{" "}
              <span className="text-foreground/90">{runData.targetUrl}</span>
            </span>
          )}
          <span>Started {formatDateTime(runData.startedAt)}</span>
          <span>
            {runData.finishedAt
              ? `Finished ${formatDateTime(runData.finishedAt)}`
              : "Still running"}
          </span>
          <span>
            Duration:{" "}
            {runDuration(runData.startedAt, runData.finishedAt) ?? (
              <span className="text-sky-300">in progress</span>
            )}
          </span>
        </div>
        {runData.status === "running" && (
          <p className="text-xs text-sky-300">
            Run in progress — refreshing every 2s; step evidence streams in
            below as it lands.
          </p>
        )}
      </div>

      {runData.result && <RunResultPanel result={runData.result} />}

      <Section eyebrow={`Step evidence · ${steps.length}`}>
        {evidence.isError && !isEngineOffline(evidence.error) && (
          <EngineErrorBanner
            title="Could not load step evidence"
            reason={engineErrorMessage(evidence.error)}
          />
        )}
        {steps.length === 0 && !evidence.isError ? (
          <EmptyState
            title="No steps logged yet"
            hint={
              runData.status === "running"
                ? "Evidence lands here as the run executes."
                : "The engine recorded no step log for this run."
            }
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <EvidenceStepRow key={`${step.stepIndex}-${i}`} step={step} />
            ))}
          </ol>
        )}
      </Section>
    </div>
  )
}

const DetailHeader = () => (
  <div className="flex flex-col gap-1.5">
    <Link
      href="/admin/runs"
      className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon className="size-3.5" />
      All runs
    </Link>
    <span className={monoEyebrow}>Run detail</span>
  </div>
)
