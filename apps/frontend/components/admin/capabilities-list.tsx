"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import {
  EngineErrorBanner,
  EngineOfflineBanner,
  EmptyState,
  LoadingRows,
  ReviewedPill,
  RiskPill,
  formatDateTime,
  monoEyebrow,
} from "@/components/admin/engine-ui"
import {
  capabilitiesQuery,
  capabilityQuery,
  engineErrorMessage,
  isEngineOffline,
  type EngineCapabilitySummary,
} from "@/lib/engine"

// GET /capabilities returns one row per stored version, newest first —
// keep the latest version of each capability (same dedupe as the overview).
const latestVersionPerCapability = (rows: EngineCapabilitySummary[]) => {
  const byId = new Map<string, EngineCapabilitySummary>()
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

export const CapabilitiesList = () => {
  const list = useQuery(capabilitiesQuery())

  const capabilities = list.data ? latestVersionPerCapability(list.data) : []

  // The list rows carry no artifact, so target app and step count come from
  // each capability's detail endpoint.
  const details = useQueries({
    queries: capabilities.map((cap) => capabilityQuery(cap.id)),
  })
  const detailById = new Map(
    capabilities.map((cap, i) => [cap.id, details[i]?.data] as const)
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <span className={monoEyebrow}>Automation console</span>
        <h1 className="text-2xl font-semibold tracking-tight">Capabilities</h1>
        <p className="text-sm text-muted-foreground">
          The saved, reviewable automation artifacts an AI agent invokes —
          steps, targeting, typed inputs and outputs, checkpoints.
        </p>
      </div>

      {list.isPending && <LoadingRows rows={3} />}

      {list.isError &&
        (isEngineOffline(list.error) ? (
          <EngineOfflineBanner reason={engineErrorMessage(list.error)} />
        ) : (
          <EngineErrorBanner reason={engineErrorMessage(list.error)} />
        ))}

      {list.isSuccess && capabilities.length === 0 && (
        <EmptyState
          title="No capabilities recorded yet"
          hint="Start a discovery run — when the engine reaches the goal it saves the flow here as a reusable capability."
        />
      )}

      {capabilities.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {capabilities.map((cap) => {
            const detail = detailById.get(cap.id)
            return (
              <Link
                key={cap.id}
                href={`/admin/capabilities/${encodeURIComponent(cap.id)}`}
                className="group flex flex-col gap-3 rounded-2xl border border-white/8 bg-card/60 p-5 transition-colors hover:border-emerald-400/25 hover:bg-emerald-400/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-semibold">
                      {cap.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {cap.id} · v{cap.version}
                    </span>
                  </div>
                  <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-300" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RiskPill risk={cap.risk} />
                  <ReviewedPill reviewed={cap.reviewed} />
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>
                    Target app:{" "}
                    <span className="text-foreground/90">
                      {detail ? detail.artifact.targetApp : "…"}
                    </span>
                  </span>
                  <span>
                    Steps:{" "}
                    <span className="text-foreground/90">
                      {detail ? detail.artifact.steps.length : "…"}
                    </span>
                  </span>
                  <span>Recorded {formatDateTime(cap.createdAt)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
