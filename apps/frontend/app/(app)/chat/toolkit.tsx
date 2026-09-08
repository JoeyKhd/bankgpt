"use generative"

import { defineToolkit, type ToolApprovalResponse } from "@assistant-ui/react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  Loader2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import type {
  Capability,
  InvokeCapabilityResult,
} from "@/lib/capabilities-catalog"
import { invokeStubCapability } from "@/lib/capabilities-catalog"

const monoEyebrow =
  "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300/80"

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

const CapabilityCard = ({ capability }: { capability: Capability }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-white/6 bg-card/60 p-4">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-foreground">
        {capability.name}
      </span>
      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
        v{capability.version}
      </span>
      <RiskBadge risk={capability.risk} />
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">
      {capability.description}
    </p>
    <div className="flex flex-col gap-1.5">
      <span className={monoEyebrow}>Inputs</span>
      <div className="flex flex-wrap gap-1.5">
        {capability.inputs.map((input) => (
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
        {capability.outputs.map((output) => (
          <TypeChip key={output.name}>
            {output.name}: {output.type}
          </TypeChip>
        ))}
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-white/6 pt-2.5 text-[11px] text-muted-foreground/80">
      <span>
        {capability.targetApp} · {capability.stepCount} steps
      </span>
      <span className="font-mono">{capability.id}</span>
    </div>
  </div>
)

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

const CapabilityListUI = ({ result }: { result?: readonly Capability[] }) =>
  result === undefined ? (
    <CapabilityListSkeleton />
  ) : (
    <div className="flex flex-col gap-3">
      {result.map((capability) => (
        <CapabilityCard key={capability.id} capability={capability} />
      ))}
      <p className="text-[11px] text-muted-foreground/70">
        Stub catalog — real capabilities appear here once the automation engine
        records them.
      </p>
    </div>
  )

const InvokeCapabilityUI = ({
  args,
  result,
  approval,
  respondToApproval,
}: {
  // Args stream in partially, so every field can be absent mid-stream.
  args?: Partial<{
    capabilityId: string
    inputs: Record<string, unknown>
  }>
  result?: InvokeCapabilityResult
  approval?: {
    approved?: boolean
    reason?: string
    resolution?: unknown
    isAutomatic?: boolean
  }
  respondToApproval: (response: ToolApprovalResponse) => Promise<void>
}) => {
  const [error, setError] = useState<string | null>(null)

  const answer = async (response: ToolApprovalResponse) => {
    setError(null)
    try {
      await respondToApproval(response)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }

  const inputs = args?.inputs ?? {}
  const hasInputs = Object.keys(inputs).length > 0

  if (approval?.approved === undefined && approval?.resolution === undefined) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-amber-300" />
          <span className="text-sm font-semibold text-amber-200">
            Approval required to run{" "}
            <span className="font-mono">{args?.capabilityId ?? "…"}</span>
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          This capability performs a consequential action in the target system.
          It only runs after a human approves it — the same policy the replay
          engine enforces in production.
        </p>
        {hasInputs && <InputsTable inputs={inputs} />}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => void answer({ approved: true })}
          >
            Approve and run
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() =>
              void answer({ approved: false, reason: "Denied by operator" })
            }
          >
            Deny
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (approval?.approved === false) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3">
        <CircleSlashIcon className="size-4 text-red-400" />
        <span className="text-sm text-red-300">
          Invocation denied
          {approval.reason ? ` — ${approval.reason}` : ""}
        </span>
      </div>
    )
  }

  if (result === undefined) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-card/60 px-4 py-3">
        <Loader2Icon className="size-4 animate-spin text-emerald-300" />
        <span className="text-sm text-muted-foreground">
          Replaying{" "}
          <span className="font-mono text-foreground">
            {args?.capabilityId ?? "…"}
          </span>{" "}
          deterministically — no model in the loop…
        </span>
      </div>
    )
  }

  if (result.status === "error") {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-4">
        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-400" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-red-300">
            Hard failure
          </span>
          <span className="text-xs leading-relaxed text-red-200/80">
            {result.message}
          </span>
        </div>
      </div>
    )
  }

  if (result.status === "business_outcome") {
    return (
      <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-amber-300" />
          <span className="text-sm font-semibold text-amber-200">
            Business outcome:{" "}
            <span className="font-mono">{result.outcome}</span>
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.detail}
        </p>
        <div className="flex items-center gap-3 border-t border-amber-400/15 pt-2 text-[11px] text-muted-foreground/80">
          <span>{result.stepsExecuted} steps</span>
          <span>{(result.durationMs / 1000).toFixed(1)}s replay</span>
          <span className="rounded-full border border-white/10 px-1.5 py-px font-mono text-[10px]">
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
          {result.capabilityName}
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          v{result.version}
        </span>
        <span className="rounded-full border border-white/10 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
          stub
        </span>
      </div>
      <OutputsTable outputs={result.outputs} />
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
        <span>{result.stepsExecuted} steps replayed</span>
        <span>{(result.durationMs / 1000).toFixed(1)}s</span>
        <span>checkpoint verified</span>
      </div>
    </div>
  )
}

export default defineToolkit({
  list_capabilities: {
    description:
      "List the saved automation capabilities the calling agent can invoke. A capability is a recorded, versioned UI-automation flow in a back-office application, with typed inputs, typed outputs, a verified checkpoint, and a risk class. Invoke capabilities instead of attempting the work free-form.",
    parameters: z.object({}),
    execute: async () => {
      const { CAPABILITIES } = await import("@/lib/capabilities-catalog")
      return CAPABILITIES
    },
    render: CapabilityListUI,
  },
  invoke_capability: {
    description:
      "Invoke a saved capability by id with its typed inputs. The automation engine replays the recorded UI flow deterministically — no model decisions — and returns a structured result: success with outputs, a known business outcome (for example member_not_found, a legitimate answer), or a hard failure. Risky capabilities require human approval before they run. Ask the user for any missing required inputs before invoking.",
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
    execute: async ({ capabilityId, inputs }) =>
      invokeStubCapability(capabilityId, inputs),
    // Approval gates and consequential results must never collapse into the
    // tool group.
    display: "standalone",
    render: InvokeCapabilityUI,
  },
})
