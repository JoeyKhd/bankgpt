import {
  ArrowRightIcon,
  BotIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  MessageSquareIcon,
  SearchIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { CAPABILITIES } from "@/lib/capabilities-catalog"
import { getEngineOverview } from "@/lib/engine/client"
import {
  engineErrorMessage,
  isEngineError,
  type EngineCapabilitySummary,
  type EngineIntervention,
  type EngineRun,
} from "@/lib/engine"

export const metadata: Metadata = { title: "Overview" }

export const dynamic = "force-dynamic"

const monoEyebrow =
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-emerald-300/80"

type EngineState =
  | {
      online: true
      capabilities: EngineCapabilitySummary[]
      runs: EngineRun[]
      interventions: EngineIntervention[]
    }
  | { online: false; reason: string }

// Live engine data when reachable; the console degrades to the stub
// catalog (plus an offline hint) when the engine is down (D-041).
const loadEngineState = async (): Promise<EngineState> => {
  try {
    const overview = await getEngineOverview()
    return { online: true, ...overview }
  } catch (error) {
    if (isEngineError(error)) {
      return { online: false, reason: engineErrorMessage(error) }
    }
    throw error
  }
}

// GET /capabilities returns one row per stored version, newest first —
// stats count each capability once, by its latest version.
const latestVersionPerCapability = (rows: EngineCapabilitySummary[]) => {
  const byId = new Map<string, EngineCapabilitySummary>()
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

const Stat = ({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string | number
  hint?: string
  tone?: "default" | "amber" | "emerald"
}) => (
  <div className="flex flex-col gap-1 rounded-2xl border border-white/8 bg-card/60 p-5">
    <span className={monoEyebrow}>{label}</span>
    <span
      className={
        tone === "amber"
          ? "text-3xl font-semibold tracking-tight text-amber-300"
          : tone === "emerald"
            ? "text-3xl font-semibold tracking-tight text-emerald-300"
            : "text-3xl font-semibold tracking-tight"
      }
    >
      {value}
    </span>
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </div>
)

const ActionCard = ({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) => (
  <Link
    href={href}
    className="group flex flex-col gap-3 rounded-2xl border border-white/8 bg-card/60 p-5 transition-colors hover:border-emerald-400/25 hover:bg-emerald-400/[0.04]"
  >
    <div className="flex items-center justify-between">
      <Icon className="size-5 text-emerald-300" />
      <ArrowRightIcon className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-300" />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </span>
    </div>
  </Link>
)

export default async function AdminOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const isAdmin = session?.user.role === "admin"

  const engine = await loadEngineState()

  const stubRiskyCount = CAPABILITIES.filter((c) => c.risk === "risky").length
  const liveCapabilities = engine.online
    ? latestVersionPerCapability(engine.capabilities)
    : []
  const capabilityCount = engine.online
    ? liveCapabilities.length
    : CAPABILITIES.length
  const riskyCount = engine.online
    ? liveCapabilities.filter((c) => c.risk === "risky").length
    : stubRiskyCount
  const openInterventions = engine.online
    ? engine.interventions.filter((i) => i.status === "pending").length
    : null
  const replayRunCount = engine.online
    ? engine.runs.filter((r) => r.kind === "replay").length
    : null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <span className={monoEyebrow}>Automation console</span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good {timeOfDay()},{" "}
          <span className="bg-[linear-gradient(105deg,#6366F1,#8B5CF6_42%,#10B981)] bg-clip-text text-transparent">
            {session?.user.name?.split(" ")[0] ?? "operator"}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Discover flows, review capabilities, replay them, and handle
          escalations — the system an AI agent calls to get work done.
        </p>
      </div>

      {!engine.online && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-amber-200">
              Engine offline — showing the stub catalog
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              Start it with{" "}
              <code className="font-mono text-emerald-300">
                pnpm --filter engine dev
              </code>{" "}
              and refresh. ({engine.reason})
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Capabilities"
          value={capabilityCount}
          hint={
            engine.online
              ? "recorded by the engine"
              : "stub catalog — engine offline"
          }
        />
        <Stat
          label="Risky"
          value={riskyCount}
          hint="need human approval to run"
          tone="amber"
        />
        <Stat
          label="Open interventions"
          value={openInterventions ?? "—"}
          hint={
            engine.online ? "waiting on a human decision" : "engine offline"
          }
        />
        <Stat
          label="Replay runs"
          value={replayRunCount ?? "—"}
          hint={engine.online ? "finished or in flight" : "engine offline"}
        />
      </div>

      {engine.online && openInterventions !== null && openInterventions > 0 && (
        <Link
          href="/admin/interventions"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 transition-colors hover:border-amber-400/40"
        >
          <div className="flex items-center gap-3">
            <BotIcon className="size-4 shrink-0 text-amber-300" />
            <span className="text-sm text-amber-200">
              {openInterventions}{" "}
              {openInterventions === 1 ? "intervention" : "interventions"}{" "}
              waiting for a human decision
            </span>
          </div>
          <ArrowRightIcon className="size-4 text-amber-300" />
        </Link>
      )}

      <div className="flex flex-col gap-3">
        <span className={monoEyebrow}>Start</span>
        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            href="/chat"
            icon={MessageSquareIcon}
            title="Caller chat"
            description="Simulate the calling AI agent: give a goal, invoke saved capabilities, approve risky ones."
          />
          <ActionCard
            href="/admin/discover"
            icon={SearchIcon}
            title="New discovery"
            description="Hand the engine a goal and a target app; it learns the flow by driving the UI."
          />
          <ActionCard
            href="/admin/capabilities"
            icon={FlaskConicalIcon}
            title="Review capabilities"
            description="The reusable artifacts: steps, targeting, typed inputs/outputs, checkpoints."
          />
          <ActionCard
            href="/admin/interventions"
            icon={BotIcon}
            title="Intervention inbox"
            description="Take over a live session when automation is stuck or needs a decision."
          />
          <ActionCard
            href="/admin/runs"
            icon={ClipboardListIcon}
            title="Run evidence"
            description="Structured logs, screenshots, and traces for every discovery and replay."
          />
          {isAdmin && (
            <ActionCard
              href="/admin/users"
              icon={ShieldAlertIcon}
              title="Manage users"
              description="Promote operators to admins or demote them (admin only)."
            />
          )}
        </div>
      </div>
    </div>
  )
}

const timeOfDay = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}
