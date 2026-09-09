"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import {
  EngineErrorBanner,
  EngineOfflineBanner,
  EmptyState,
  KindPill,
  LoadingRows,
  RunStatusPill,
  formatDateTime,
  monoEyebrow,
  runDuration,
} from "@/components/admin/engine-ui"
import { engineErrorMessage, isEngineOffline, runsQuery } from "@/lib/engine"

export const RunsList = () => {
  const runs = useQuery(runsQuery())

  const sorted = runs.data
    ? [...runs.data].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
    : []
  const anyRunning = sorted.some((run) => run.status === "running")

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <span className={monoEyebrow}>Automation console</span>
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-muted-foreground">
          Structured evidence for every discovery and replay execution.
          {anyRunning && (
            <span className="text-sky-300">
              {" "}
              Live — polling every 2s while a run is in flight.
            </span>
          )}
        </p>
      </div>

      {runs.isPending && <LoadingRows rows={4} />}

      {runs.isError &&
        (isEngineOffline(runs.error) ? (
          <EngineOfflineBanner reason={engineErrorMessage(runs.error)} />
        ) : (
          <EngineErrorBanner reason={engineErrorMessage(runs.error)} />
        ))}

      {runs.isSuccess && sorted.length === 0 && (
        <EmptyState
          title="No runs yet"
          hint="Start a discovery run or replay a capability — every execution lands here with its step-by-step evidence."
        />
      )}

      {sorted.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/8">
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-4 border-b border-white/8 bg-white/[0.02] px-4 py-2.5">
            <span className={monoEyebrow}>Status</span>
            <span className={monoEyebrow}>Kind</span>
            <span className={monoEyebrow}>Run</span>
            <span className={monoEyebrow}>Started</span>
            <span className={monoEyebrow}>Duration</span>
          </div>
          {sorted.map((run) => (
            <Link
              key={run.id}
              href={`/admin/runs/${encodeURIComponent(run.id)}`}
              className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-4 border-b border-white/6 px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.03]"
            >
              <RunStatusPill status={run.status} />
              <KindPill kind={run.kind} />
              <div className="flex min-w-0 flex-col">
                {run.kind === "replay" && run.capabilityId ? (
                  <span className="truncate font-mono text-sm">
                    {run.capabilityId}
                  </span>
                ) : (
                  <span className="truncate text-sm">{run.goal ?? run.id}</span>
                )}
                <span className="truncate font-mono text-xs text-muted-foreground/70">
                  {run.id}
                </span>
              </div>
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {formatDateTime(run.startedAt)}
              </span>
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {runDuration(run.startedAt, run.finishedAt) ?? (
                  <span className="text-sky-300">running…</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
