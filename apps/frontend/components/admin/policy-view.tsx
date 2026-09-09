"use client"

import { useQuery } from "@tanstack/react-query"
import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react"

import {
  EngineErrorBanner,
  EngineOfflineBanner,
  LoadingRows,
  formatDurationMs,
  monoEyebrow,
} from "@/components/admin/engine-ui"
import {
  engineErrorMessage,
  isEngineOffline,
  policyQuery,
  type EnginePolicy,
  type StepAction,
} from "@/lib/engine"

const Row = ({
  label,
  hint,
  value,
}: {
  label: string
  hint?: string
  value: React.ReactNode
}) => (
  <div className="flex items-start justify-between gap-6 border-b border-white/6 px-4 py-3 last:border-0">
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {hint && (
        <span className="text-xs leading-relaxed text-muted-foreground/60">
          {hint}
        </span>
      )}
    </div>
    <span className="text-right text-sm">{value}</span>
  </div>
)

const TypeChip = ({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "emerald" | "amber"
  children: React.ReactNode
}) => (
  <span
    className={
      tone === "emerald"
        ? "rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 font-mono text-xs text-emerald-300"
        : tone === "amber"
          ? "rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-1.5 py-0.5 font-mono text-xs text-amber-300"
          : "rounded-md border border-white/8 bg-white/[0.03] px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
    }
  >
    {children}
  </span>
)

const ChipRow = ({
  actions,
  tone,
}: {
  actions: readonly StepAction[]
  tone?: "neutral" | "emerald" | "amber"
}) => (
  <span className="flex flex-wrap justify-end gap-1.5">
    {actions.map((action) => (
      <TypeChip key={action} tone={tone}>
        {action}
      </TypeChip>
    ))}
  </span>
)

// Actions that are allowed but NOT in the safe set are treated as risky:
// each occurrence needs an approval token before the engine executes it.
const riskyActions = (policy: EnginePolicy): StepAction[] =>
  policy.allowedActions.filter((action) => !policy.safeActions.includes(action))

const PolicySections = ({ policy }: { policy: EnginePolicy }) => {
  const risky = riskyActions(policy)
  return (
    <>
      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Target scope</span>
        <div className="rounded-2xl border border-white/8">
          <Row
            label="URL allowlist"
            hint="The page URL must match one of these patterns — checked before every navigation and every action, in discovery and replay."
            value={
              <span className="flex flex-col items-end gap-1.5">
                {policy.allowedUrlPatterns.map((pattern) => (
                  <TypeChip key={pattern}>{pattern}</TypeChip>
                ))}
              </span>
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Action policy</span>
        <div className="rounded-2xl border border-white/8">
          <Row
            label="Allowed action types"
            hint="The fixed action vocabulary — discovery cannot invent actions outside it."
            value={<ChipRow actions={policy.allowedActions} />}
          />
          <Row
            label="Safe / reversible actions"
            value={
              <span className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <ShieldCheckIcon className="size-4" /> Run automatically
                </span>
                <ChipRow actions={policy.safeActions} tone="emerald" />
              </span>
            }
          />
          <Row
            label="Risky actions"
            hint="Allowed but outside the safe set — each occurrence requires an approval token."
            value={
              risky.length > 0 ? (
                <span className="flex flex-col items-end gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-amber-300">
                    <ShieldAlertIcon className="size-4" /> Approval per
                    occurrence
                  </span>
                  <ChipRow actions={risky} tone="amber" />
                </span>
              ) : (
                <span className="text-muted-foreground/70">
                  none — every allowed action is in the safe set
                </span>
              )
            }
          />
          <Row
            label="Risky capability classes"
            hint="A capability with this risk class always replays behind an approval token."
            value={
              <span className="flex flex-wrap justify-end gap-1.5">
                {policy.riskyClassesRequireApproval.map((risk) => (
                  <TypeChip key={risk} tone="amber">
                    {risk}
                  </TypeChip>
                ))}
              </span>
            }
          />
          <Row
            label="Human review of risky capabilities"
            hint="requireReviewForRisky — an unreviewed risky capability is refused even with approval."
            value={
              policy.requireReviewForRisky ? (
                <span className="text-emerald-300">required</span>
              ) : (
                <span className="text-muted-foreground/70">not required</span>
              )
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Dialogs &amp; resilience</span>
        <div className="rounded-2xl border border-white/8">
          <Row
            label="Browser-native dialogs"
            hint="confirm / alert / prompt — legacy back-office apps gate risky submits on a native confirm. Every handled dialog is logged to the run evidence."
            value={
              policy.dialogHandling === "accept" ? (
                <span className="inline-flex items-center gap-1.5">
                  <TypeChip tone="amber">accept</TypeChip>
                  <span className="text-xs text-muted-foreground">
                    let the recorded flow proceed
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <TypeChip>dismiss</TypeChip>
                  <span className="text-xs text-muted-foreground">
                    cancel every dialog
                  </span>
                </span>
              )
            }
          />
          <Row
            label="Transient error recovery"
            hint="After a transient error page, reload the idempotent page and re-drive the step — a failed POST is never blindly repeated."
            value={
              <span className="font-mono text-xs">
                up to {policy.transientErrorMaxReloads}{" "}
                {policy.transientErrorMaxReloads === 1 ? "reload" : "reloads"}
              </span>
            }
          />
          <Row
            label="Discovery bounds"
            hint="The discovery loop stops itself at these limits."
            value={
              <span className="font-mono text-xs">
                {policy.maxDiscoverySteps} steps ·{" "}
                {formatDurationMs(policy.discoveryTimeoutMs)}
              </span>
            }
          />
          <Row
            label="Operator handoff timeout"
            hint="How long a stuck run waits for a human to take over and hand control back before it fails."
            value={
              <span className="font-mono text-xs">
                {formatDurationMs(policy.handoffTimeoutMs)}
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
          <Row
            label="Redaction"
            hint="Engine-side code (redactText / redactValue in apps/engine/src/policy.ts) scrubs API keys, bearer tokens, SSNs, card-shaped numbers, and password=/token= style values before anything is written — every JSON response (this one included) and every evidence file."
            value={<span>always on</span>}
          />
          <Row
            label="Credentials on proxy targets"
            value={<span>test doubles only, no real credentials or PII</span>}
          />
        </div>
      </section>
    </>
  )
}

// The live /admin/policy surface: renders the engine's effective safety
// policy (GET /policy) instead of a hardcoded summary. Editing stays out of
// the UI on purpose — the assignment asks for a configurable allowlist via
// config, not a policy editor.
export const PolicyView = () => {
  const policy = useQuery(policyQuery())

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Safety policy</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          What the engine is allowed to do, and how risky actions are treated.
          Live, read-only view of the policy the engine enforces during
          discovery and replay.
        </p>
      </div>

      {policy.isPending && <LoadingRows rows={3} />}

      {policy.isError &&
        (isEngineOffline(policy.error) ? (
          <>
            <EngineOfflineBanner reason={engineErrorMessage(policy.error)} />
            <p className="text-xs leading-relaxed text-muted-foreground/70">
              The effective policy is defined in code —{" "}
              <code className="font-mono text-emerald-300">
                apps/engine/src/policy.ts
              </code>{" "}
              (<code className="font-mono">defaultPolicy()</code>, or{" "}
              <code className="font-mono">ServerOptions.policy</code> injected
              by the host process). Start the engine to read the live values
              from <code className="font-mono">GET /policy</code>.
            </p>
          </>
        ) : (
          <EngineErrorBanner reason={engineErrorMessage(policy.error)} />
        ))}

      {policy.isSuccess && <PolicySections policy={policy.data} />}

      <p className="text-xs leading-relaxed text-muted-foreground/70">
        Read-only by design: the assignment asks for an explicit, configurable
        allowlist — a config concern, not a policy editor. To change the policy,
        edit{" "}
        <code className="font-mono text-emerald-300">
          apps/engine/src/policy.ts
        </code>{" "}
        (<code className="font-mono">defaultPolicy()</code>) or inject{" "}
        <code className="font-mono">ServerOptions.policy</code>, then restart
        the engine; this page always reflects what the running engine enforces.
      </p>
    </div>
  )
}
