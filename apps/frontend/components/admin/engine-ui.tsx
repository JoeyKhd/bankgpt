"use client"

import { TriangleAlertIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { RiskClass, RunStatus } from "@/lib/engine"

/** IBM Plex Mono eyebrow label, shared across the console pages. */
export const monoEyebrow =
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-emerald-300/80"

// ── Pills ────────────────────────────────────────────────────────────────

const pillBase =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"

const STATUS_TONE: Record<RunStatus, string> = {
  awaiting_approval: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  running: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  business_outcome: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  recoverable: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  hard_failure: "border-red-400/25 bg-red-400/10 text-red-300",
  stuck: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  stopped: "border-white/15 bg-white/[0.04] text-muted-foreground",
}

const STATUS_LABEL: Record<RunStatus, string> = {
  awaiting_approval: "awaiting approval",
  running: "running",
  success: "success",
  business_outcome: "business outcome",
  recoverable: "recoverable",
  hard_failure: "hard failure",
  stuck: "stuck",
  stopped: "stopped",
}

export const RunStatusPill = ({ status }: { status: RunStatus }) => (
  <span className={cn(pillBase, STATUS_TONE[status])}>
    {status === "running" && (
      <span className="size-1.5 animate-pulse rounded-full bg-sky-300" />
    )}
    {STATUS_LABEL[status]}
  </span>
)

export const RiskPill = ({ risk }: { risk: RiskClass }) => (
  <span
    className={cn(
      pillBase,
      risk === "risky"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
        : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
    )}
  >
    {risk}
  </span>
)

export const ReviewedPill = ({ reviewed }: { reviewed: boolean }) => (
  <span
    className={cn(
      pillBase,
      reviewed
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
        : "border-white/15 bg-white/[0.04] text-muted-foreground"
    )}
  >
    {reviewed ? "reviewed" : "unreviewed"}
  </span>
)

export const KindPill = ({ kind }: { kind: "discovery" | "replay" }) => (
  <span
    className={cn(
      pillBase,
      kind === "discovery"
        ? "border-violet-400/25 bg-violet-400/10 text-violet-300"
        : "border-sky-400/25 bg-sky-400/10 text-sky-300"
    )}
  >
    {kind}
  </span>
)

export const EvidenceResultPill = ({
  result,
}: {
  result: "ok" | "failed" | "skipped"
}) => (
  <span
    className={cn(
      pillBase,
      result === "ok"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
        : result === "failed"
          ? "border-red-400/25 bg-red-400/10 text-red-300"
          : "border-white/15 bg-white/[0.04] text-muted-foreground"
    )}
  >
    {result}
  </span>
)

// ── Query states ─────────────────────────────────────────────────────────

/** Amber engine-offline banner; same pattern as the /admin overview. */
export const EngineOfflineBanner = ({ reason }: { reason: string }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-300" />
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-amber-200">
        Engine offline — live data unavailable
      </span>
      <span className="text-xs leading-relaxed text-muted-foreground">
        Start it with{" "}
        <code className="font-mono text-emerald-300">
          pnpm --filter engine dev
        </code>{" "}
        and refresh. ({reason})
      </span>
    </div>
  </div>
)

/** Non-offline engine failure (HTTP error or contract drift). */
export const EngineErrorBanner = ({
  title = "Engine request failed",
  reason,
}: {
  title?: string
  reason: string
}) => (
  <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4">
    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-300" />
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-red-200">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">
        {reason}
      </span>
    </div>
  </div>
)

/** Skeleton placeholder while a query loads for the first time. */
export const LoadingRows = ({ rows = 3 }: { rows?: number }) => (
  <div className="flex flex-col gap-3" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => (
      <Skeleton key={i} className="h-24 w-full rounded-2xl bg-white/[0.04]" />
    ))}
  </div>
)

export const EmptyState = ({
  title,
  hint,
}: {
  title: string
  hint?: string
}) => (
  <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-white/12 bg-card/40 p-6">
    <span className="text-sm font-medium">{title}</span>
    {hint && (
      <span className="text-xs leading-relaxed text-muted-foreground">
        {hint}
      </span>
    )}
  </div>
)

/** Card section with a mono eyebrow header, matching the overview cards. */
export const Section = ({
  eyebrow,
  children,
  className,
}: {
  eyebrow: string
  children: React.ReactNode
  className?: string
}) => (
  <section
    className={cn(
      "flex flex-col gap-4 rounded-2xl border border-white/8 bg-card/60 p-5",
      className
    )}
  >
    <span className={monoEyebrow}>{eyebrow}</span>
    {children}
  </section>
)

// ── Formatters ───────────────────────────────────────────────────────────

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))

export const formatDurationMs = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/** Wall-clock duration of a run row; null while it is still running. */
export const runDuration = (
  startedAt: string,
  finishedAt: string | null
): string | null => {
  if (!finishedAt) return null
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  return formatDurationMs(Math.max(0, ms))
}
