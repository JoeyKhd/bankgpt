import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Safety policy" }

const monoEyebrow =
  "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300/80"

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 border-b border-white/6 px-4 py-3 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right text-sm">{value}</span>
  </div>
)

const TypeChip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md border border-white/8 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
    {children}
  </span>
)

// The assignment's safety policy (§3.4), as enforced today. The enforcement
// points are real (chat toolApproval gate); the target-app allowlist lands
// with the engine. Editable policy is a later decision, not promised here.
export default function PolicyPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Safety policy</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          What the system is allowed to do, and how risky actions are treated.
          Read-only view of the current policy.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Action policy</span>
        <div className="rounded-2xl border border-white/8">
          <Row
            label="Safe / reversible actions"
            value={
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <ShieldCheckIcon className="size-4" /> Run automatically
              </span>
            }
          />
          <Row
            label="Risky / irreversible actions"
            value={
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <ShieldAlertIcon className="size-4" /> Require human approval
              </span>
            }
          />
          <Row
            label="Enforced at"
            value={
              <span className="font-mono text-xs text-muted-foreground">
                chat toolApproval gate → engine policy (planned)
              </span>
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Target allowlist</span>
        <div className="rounded-2xl border border-white/8">
          <Row
            label="Permitted domains / routes"
            value={
              <span className="text-muted-foreground/70">
                not configured — set when the proxy target is chosen
              </span>
            }
          />
          <Row
            label="Allowed action types"
            value={
              <span className="flex flex-wrap justify-end gap-1.5">
                <TypeChip>navigate</TypeChip>
                <TypeChip>click</TypeChip>
                <TypeChip>type</TypeChip>
                <TypeChip>read</TypeChip>
                <TypeChip>extract</TypeChip>
              </span>
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Sensitive data</span>
        <div className="rounded-2xl border border-white/8">
          <Row
            label="Secrets in artifacts / logs"
            value={<span className="text-red-300">never persisted</span>}
          />
          <Row label="Evidence" value={<span>redacted before storage</span>} />
          <Row
            label="Credentials on proxy targets"
            value={<span>test doubles only, no real credentials or PII</span>}
          />
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        Editing this policy in the UI is intentionally not built — the
        assignment asks for an explicit, configurable allowlist (a config file),
        not a policy editor. The engine will read the same policy when it
        enforces scope during discovery and replay.
      </p>
    </div>
  )
}
