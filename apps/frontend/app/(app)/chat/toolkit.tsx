"use generative"

import { useEffect, useState } from "react"
import { defineToolkit } from "@assistant-ui/react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  Loader2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"
import { z } from "zod"

import type {
  Capability,
  CapabilityRisk,
  InvokeCapabilityResult,
} from "@/lib/capabilities-catalog"
import { invokeStubCapability } from "@/lib/capabilities-catalog"
import type { InvokeLiveResult } from "@/lib/engine/invoke"
import type { EngineCapability } from "@/lib/engine"

const monoEyebrow =
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-emerald-300/80"

const RiskBadge = ({ risk }: { risk: Capability["risk"] }) =>
  risk === "risky" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      <ShieldAlertIcon className="size-3" />
      approval required
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
      <ShieldCheckIcon className="size-3" />
      safe
    </span>
  )

const TypeChip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md border border-white/8 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
    {children}
  </span>
)

// Normalize a stub-catalog capability and a live engine capability to one
// shape for display. The stub carries flat fields; the engine nests them in
// the artifact.
type DisplayCapability = {
  id: string
  version: string
  name: string
  description: string
  targetApp: string
  risk: "safe" | "risky"
  inputs: readonly {
    name: string
    type: string
    required: boolean
    values?: readonly string[]
  }[]
  outputs: readonly { name: string; type: string }[]
  stepCount: number
}

const toDisplayCapability = (
  capability: Capability | EngineCapability
): DisplayCapability => {
  if ("artifact" in capability) {
    return {
      id: capability.id,
      version: capability.version,
      name: capability.name,
      description: capability.artifact.description,
      targetApp: capability.artifact.targetApp,
      risk: capability.risk,
      inputs: capability.artifact.inputs,
      outputs: capability.artifact.outputs,
      stepCount: capability.artifact.steps.length,
    }
  }
  return capability
}

const CapabilityCard = ({
  capability,
}: {
  capability: Capability | EngineCapability
}) => {
  const display = toDisplayCapability(capability)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/6 bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          {display.name}
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-xs text-muted-foreground">
          v{display.version}
        </span>
        <RiskBadge risk={display.risk} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {display.description}
      </p>
      <div className="flex flex-col gap-1.5">
        <span className={monoEyebrow}>Inputs</span>
        <div className="flex flex-wrap gap-1.5">
          {display.inputs.map((input) => (
            <TypeChip key={input.name}>
              {input.name}
              {input.required ? "*" : ""}:{" "}
              {input.type === "enum" ? input.values?.join(" | ") : input.type}
            </TypeChip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={monoEyebrow}>Outputs</span>
        <div className="flex flex-wrap gap-1.5">
          {display.outputs.map((output) => (
            <TypeChip key={output.name}>
              {output.name}: {output.type}
            </TypeChip>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/6 pt-2.5 text-[11px] text-muted-foreground/80">
        <span>
          {display.targetApp} · {display.stepCount} steps
        </span>
        <span className="font-mono">{display.id}</span>
      </div>
    </div>
  )
}

const CapabilityListSkeleton = () => (
  <div className="flex flex-col gap-3">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="h-28 animate-pulse rounded-2xl border border-white/6 bg-card/40"
      />
    ))}
  </div>
)

const InputsTable = ({ inputs }: { inputs: Record<string, unknown> }) => (
  <div className="overflow-hidden rounded-lg border border-white/8">
    {Object.entries(inputs).map(([key, value], index) => (
      <div
        key={key}
        className={`flex items-center justify-between gap-4 px-3 py-1.5 text-xs ${
          index % 2 === 0 ? "bg-white/[0.02]" : ""
        }`}
      >
        <span className="font-mono text-muted-foreground">{key}</span>
        <span className="font-mono text-foreground">{String(value)}</span>
      </div>
    ))}
  </div>
)

const OutputsTable = ({
  outputs,
}: {
  outputs: Record<string, string | number | boolean>
}) => (
  <div className="overflow-hidden rounded-lg border border-emerald-400/15">
    {Object.entries(outputs).map(([key, value], index) => (
      <div
        key={key}
        className={`flex items-center justify-between gap-4 px-3 py-1.5 text-xs ${
          index % 2 === 0 ? "bg-emerald-400/[0.04]" : ""
        }`}
      >
        <span className="font-mono text-muted-foreground">{key}</span>
        <span className="font-mono text-emerald-200">
          {typeof value === "number"
            ? value.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : String(value)}
        </span>
      </div>
    ))}
  </div>
)

// ── Capability list ──────────────────────────────────────────────────────

// The list tool shows the live engine catalog; when the engine is offline it
// clearly labels the stub catalog so the demo stays navigable.
type ListResult =
  | { source: "live"; capabilities: EngineCapability[] }
  | { source: "stub"; capabilities: readonly Capability[] }

const CapabilityListUI = ({ result }: { result?: ListResult }) =>
  result === undefined ? (
    <CapabilityListSkeleton />
  ) : (
    <div className="flex flex-col gap-3">
      {result.capabilities.map((capability) => (
        <CapabilityCard key={capability.id} capability={capability} />
      ))}
      <p className="text-[11px] text-muted-foreground/70">
        {result.source === "live"
          ? "Live catalog from the automation engine."
          : "Engine offline — showing the stub catalog. Start it with `pnpm --filter engine dev`."}
      </p>
    </div>
  )

// ── invoke_capability render ─────────────────────────────────────────────

// The result the tool produces: a live engine outcome, or a stub outcome
// (only possible for SAFE capabilities when the engine is offline).
type InvokeResult =
  | { source: "live"; live: InvokeLiveResult }
  | { source: "stub"; stub: InvokeCapabilityResult }

// Resolve the invoked capability's risk class the same way the executor
// does: live engine catalog first, stub catalog when the engine is offline.
// `live` records WHICH source answered — approval wording is only truthful
// when the live engine confirmed the capability is risky, because only then
// does the executor actually raise an approval intervention.
const useInvocationRisk = (capabilityId: string | undefined) => {
  // The resolution is tagged with the id it belongs to; a stale resolution
  // for a previous id reads as unresolved, so no synchronous reset is needed.
  const [resolution, setResolution] = useState<
    { capabilityId: string; risk: CapabilityRisk; live: boolean } | undefined
  >(undefined)
  useEffect(() => {
    if (!capabilityId) return
    let cancelled = false
    const resolveRisk = async () => {
      try {
        const { listLiveCapabilities } = await import("@/lib/engine/invoke")
        const match = (await listLiveCapabilities()).find(
          (capability) => capability.id === capabilityId
        )
        if (match) {
          if (!cancelled)
            setResolution({ capabilityId, risk: match.risk, live: true })
          return
        }
      } catch {
        // Engine offline — fall back to the stub catalog below.
      }
      const { getCapabilityRisk } = await import("@/lib/capabilities-catalog")
      const risk = getCapabilityRisk(capabilityId)
      if (!cancelled && risk) setResolution({ capabilityId, risk, live: false })
    }
    void resolveRisk()
    return () => {
      cancelled = true
    }
  }, [capabilityId])
  return capabilityId !== undefined && resolution?.capabilityId === capabilityId
    ? resolution
    : undefined
}

// Neutral in-flight state. It makes NO claim about approval requests — a
// safe invocation never raises one, and claiming otherwise is a lie.
const RunningInvocation = ({
  capabilityId,
  inputs,
}: {
  capabilityId?: string
  inputs: Record<string, unknown>
}) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card/60 p-4">
    <div className="flex items-center gap-2">
      <Loader2Icon className="size-4 animate-spin text-emerald-300" />
      <span className="text-sm font-semibold text-foreground">
        Invoking <span className="font-mono">{capabilityId ?? "…"}</span>
      </span>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">
      Submitting to the automation engine, which replays the recorded flow in
      the target application — deterministically, with no model in the loop.
    </p>
    {Object.keys(inputs).length > 0 && <InputsTable inputs={inputs} />}
  </div>
)

const WaitingForOperator = ({
  capabilityId,
  inputs,
}: {
  capabilityId?: string
  inputs: Record<string, unknown>
}) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
    <div className="flex items-center gap-2">
      <Loader2Icon className="size-4 animate-spin text-amber-300" />
      <span className="text-sm font-semibold text-amber-200">
        Waiting for an operator to approve{" "}
        <span className="font-mono">{capabilityId ?? "…"}</span>
      </span>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">
      This capability performs a consequential action. A request was raised with
      your inputs and is now in the{" "}
      <span className="font-medium text-foreground">Interventions</span> inbox,
      where a different operator approves or rejects it. You cannot approve your
      own request. The run starts automatically once approved.
    </p>
    {Object.keys(inputs).length > 0 && <InputsTable inputs={inputs} />}
  </div>
)

const InvokeCapabilityUI = ({
  args,
  result,
}: {
  args?: Partial<{
    capabilityId: string
    inputs: Record<string, unknown>
  }>
  result?: InvokeResult
}) => {
  const inputs = args?.inputs ?? {}
  const resolution = useInvocationRisk(args?.capabilityId)

  // Running: show the operator-approval card only once the LIVE engine
  // catalog has confirmed the capability is risky — that is the one case
  // where the executor raises a real approval intervention. Safe invocations
  // (and anything not yet resolved) get the neutral running state instead of
  // a false claim that an approval request exists.
  if (result === undefined) {
    return resolution?.live && resolution.risk === "risky" ? (
      <WaitingForOperator capabilityId={args?.capabilityId} inputs={inputs} />
    ) : (
      <RunningInvocation capabilityId={args?.capabilityId} inputs={inputs} />
    )
  }

  // ── Live engine outcomes ──
  if (result.source === "live") {
    const live = result.live
    if (live.kind === "success") {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2Icon className="size-4 text-emerald-300" />
            <span className="text-sm font-semibold text-emerald-200">
              {args?.capabilityId ?? "Capability"}
            </span>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-px font-mono text-xs text-emerald-300">
              engine
            </span>
          </div>
          <OutputsTable outputs={live.outputs} />
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
            <span>{live.stepsExecuted} steps replayed</span>
            <span>{(live.durationMs / 1000).toFixed(1)}s</span>
            <span>checkpoint verified</span>
          </div>
        </div>
      )
    }
    if (live.kind === "business_outcome") {
      return (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-amber-300" />
            <span className="text-sm font-semibold text-amber-200">
              Business outcome:{" "}
              <span className="font-mono">{live.outcome}</span>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {live.detail}
          </p>
          <div className="flex items-center gap-3 border-t border-amber-400/15 pt-2 text-[11px] text-muted-foreground/80">
            <span>{live.stepsExecuted} steps</span>
            <span>{(live.durationMs / 1000).toFixed(1)}s replay</span>
          </div>
        </div>
      )
    }
    if (live.kind === "denied") {
      return (
        <div className="flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3">
          <CircleSlashIcon className="size-4 text-red-400" />
          <span className="text-sm text-red-300">
            Invocation rejected by {live.decidedBy ?? "an operator"}
            {live.decisionReason ? ` — ${live.decisionReason}` : ""}
          </span>
        </div>
      )
    }
    if (live.kind === "engine_offline") {
      return (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-amber-200">
              Engine offline
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              This capability is risky and needs operator approval, so it cannot
              run from the stub catalog. Start the engine with{" "}
              <code className="font-mono text-emerald-300">
                pnpm --filter engine dev
              </code>{" "}
              and try again.
            </span>
          </div>
        </div>
      )
    }
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-4">
        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-400" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-red-300">
            Hard failure
          </span>
          <span className="text-xs leading-relaxed text-red-200/80">
            {live.kind === "hard_failure"
              ? `${live.expected} — observed: ${live.observed}`
              : live.message}
          </span>
        </div>
      </div>
    )
  }

  // ── Stub fallback (safe capabilities only, engine offline) ──
  const stub = result.stub
  if (stub.status === "error") {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-4">
        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-400" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-red-300">
            Hard failure
          </span>
          <span className="text-xs leading-relaxed text-red-200/80">
            {stub.message}
          </span>
        </div>
      </div>
    )
  }
  if (stub.status === "business_outcome") {
    return (
      <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-amber-300" />
          <span className="text-sm font-semibold text-amber-200">
            Business outcome: <span className="font-mono">{stub.outcome}</span>
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {stub.detail}
        </p>
        <div className="flex items-center gap-3 border-t border-amber-400/15 pt-2 text-[11px] text-muted-foreground/80">
          <span>{stub.stepsExecuted} steps</span>
          <span>{(stub.durationMs / 1000).toFixed(1)}s replay</span>
          <span className="rounded-full border border-white/10 px-1.5 py-px font-mono text-xs">
            stub
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2Icon className="size-4 text-emerald-300" />
        <span className="text-sm font-semibold text-emerald-200">
          {stub.capabilityName}
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-xs text-muted-foreground">
          v{stub.version}
        </span>
        <span className="rounded-full border border-white/10 px-1.5 py-px font-mono text-xs text-muted-foreground">
          stub
        </span>
      </div>
      <OutputsTable outputs={stub.outputs} />
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
        <span>{stub.stepsExecuted} steps replayed</span>
        <span>{(stub.durationMs / 1000).toFixed(1)}s</span>
        <span>checkpoint verified</span>
      </div>
    </div>
  )
}

// The invoke executor: FRONTEND tool ("use client") so it calls the
// authenticated /api/engine proxy with the signed-in user's cookies. Risky
// capabilities raise an approval intervention (a different operator decides
// in /admin/interventions); safe capabilities replay straight through.
const runInvoke = async ({
  capabilityId,
  inputs,
}: {
  capabilityId: string
  inputs: Record<string, unknown>
}): Promise<InvokeResult> => {
  const { listLiveCapabilities, invokeLiveCapability } =
    await import("@/lib/engine/invoke")
  // Look up the capability's risk class from the live catalog.
  let risky: boolean | undefined
  try {
    const caps = await listLiveCapabilities()
    risky = caps.find((cap) => cap.id === capabilityId)?.risk === "risky"
  } catch {
    risky = undefined // engine offline — fall through to the stub
  }

  if (risky !== undefined) {
    const live = await invokeLiveCapability({
      capabilityId,
      inputs: inputs as Record<string, string | number | boolean>,
      risky,
    })
    // A risky capability with the engine offline must NOT silently stub —
    // it needs the segregated approval, which only the engine enforces.
    if (risky && live.kind === "engine_offline") {
      return { source: "live", live }
    }
    return { source: "live", live }
  }

  // Engine offline AND (safe or unknown): the stub catalog keeps the demo
  // navigable for SAFE capabilities only. Risky ones never stub.
  const { getCapabilityRisk } = await import("@/lib/capabilities-catalog")
  if (getCapabilityRisk(capabilityId) === "risky") {
    return {
      source: "live",
      live: { kind: "engine_offline" },
    }
  }
  return {
    source: "stub",
    stub: await invokeStubCapability(capabilityId, inputs),
  }
}

export default defineToolkit({
  list_capabilities: {
    description:
      "List the saved automation capabilities the calling agent can invoke. A capability is a recorded, versioned UI-automation flow in a back-office application, with typed inputs, typed outputs, a verified checkpoint, and a risk class. Invoke capabilities instead of attempting the work free-form.",
    parameters: z.object({}),
    execute: async (): Promise<ListResult> => {
      "use client"
      try {
        const { listLiveCapabilities } = await import("@/lib/engine/invoke")
        return { source: "live", capabilities: await listLiveCapabilities() }
      } catch {
        const { CAPABILITIES } = await import("@/lib/capabilities-catalog")
        return { source: "stub", capabilities: CAPABILITIES }
      }
    },
    render: CapabilityListUI,
  },
  invoke_capability: {
    description:
      "Invoke a saved capability by id with its typed inputs. The automation engine replays the recorded UI flow deterministically — no model decisions — and returns a structured result: success with outputs, a known business outcome (for example member_not_found, a legitimate answer), or a hard failure. Risky capabilities raise an operator approval first; the run waits for a different operator to decide and only then executes. Ask the user for any missing required inputs before invoking.",
    parameters: z.object({
      capabilityId: z
        .string()
        .describe(
          'The capability id from list_capabilities, e.g. "lookup_member_balance".'
        ),
      inputs: z
        .record(z.string(), z.unknown())
        .describe(
          "Input values keyed by the capability's input names, matching its declared types."
        ),
    }),
    // FRONTEND executor: the "use client" directive inside this INLINE
    // function body is what the "use generative" compiler keys on — a
    // referenced or cast function would be misclassified as a backend tool
    // and dropped from the client build. Keep the executor inline.
    execute: async (args: {
      capabilityId: string
      inputs: Record<string, unknown>
    }): Promise<InvokeResult> => {
      "use client"
      return runInvoke(args)
    },
    // Approval and consequential results must never collapse into the tool group.
    display: "standalone",
    render: InvokeCapabilityUI,
  },
})
