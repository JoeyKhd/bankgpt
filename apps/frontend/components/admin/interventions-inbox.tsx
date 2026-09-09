"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  HandIcon,
  Loader2Icon,
  MonitorIcon,
  PauseIcon,
  PlayIcon,
  ShieldAlertIcon,
  UserIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  EngineErrorBanner,
  EngineOfflineBanner,
  EmptyState,
  LoadingRows,
  Section,
  formatDateTime,
  monoEyebrow,
} from "@/components/admin/engine-ui"
import {
  approveIntervention,
  connectEngineControl,
  engineErrorMessage,
  isEngineOffline,
  interventionsQuery,
  postSessionAction,
  rejectIntervention,
  sessionStateQuery,
  type EngineIntervention,
  type EngineControlMessage,
  type SessionState,
} from "@/lib/engine"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

// ── Shared bits ──────────────────────────────────────────────────────────

const pillBase =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"

const KindPill = ({ kind }: { kind: string }) =>
  kind === "approval" ? (
    <span
      className={cn(
        pillBase,
        "border-amber-400/25 bg-amber-400/10 text-amber-300"
      )}
    >
      <ShieldAlertIcon className="size-3" />
      approval
    </span>
  ) : (
    <span
      className={cn(
        pillBase,
        "border-violet-400/25 bg-violet-400/10 text-violet-300"
      )}
    >
      <HandIcon className="size-3" />
      stuck
    </span>
  )

const StatusPill = ({ status }: { status: EngineIntervention["status"] }) => (
  <span
    className={cn(
      pillBase,
      status === "pending"
        ? "border-sky-400/25 bg-sky-400/10 text-sky-300"
        : status === "approved" || status === "resolved"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-red-400/25 bg-red-400/10 text-red-300"
    )}
  >
    {status === "pending" && (
      <span className="size-1.5 animate-pulse rounded-full bg-sky-300" />
    )}
    {status}
  </span>
)

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 text-xs">
    <span className="shrink-0 font-mono text-muted-foreground/80">{label}</span>
    <span className="truncate text-right text-foreground">{value}</span>
  </div>
)

const InputsTable = ({ inputs }: { inputs: Record<string, unknown> }) => (
  <div className="overflow-hidden rounded-lg border border-white/8">
    {Object.entries(inputs).map(([key, value], index) => (
      <div
        key={key}
        className={cn(
          "flex items-center justify-between gap-4 px-3 py-1.5 text-xs",
          index % 2 === 0 && "bg-white/[0.02]"
        )}
      >
        <span className="font-mono text-muted-foreground">{key}</span>
        <span className="font-mono text-foreground">{String(value)}</span>
      </div>
    ))}
  </div>
)

// ── Approval decision card ───────────────────────────────────────────────

// The segregation rule: whoever REQUESTED the approval is surfaced, and the
// decider is always the signed-in operator. If the same account does both,
// the engine still records the decision and flags it selfApproved in the
// evidence.
const ApprovalCard = ({
  intervention,
  sessionEmail,
}: {
  intervention: EngineIntervention
  sessionEmail: string | undefined
}) => {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["engine", "interventions"],
    })
    void queryClient.invalidateQueries({ queryKey: ["engine", "runs"] })
  }

  const decide = useMutation({
    mutationFn: async (approved: boolean) => {
      const body = { reason: reason.trim() || undefined }
      return approved
        ? approveIntervention(intervention.id, body)
        : rejectIntervention(intervention.id, body)
    },
    onSuccess: () => {
      setReason("")
      invalidate()
    },
    onError: (failure) =>
      setError(failure instanceof Error ? failure.message : String(failure)),
  })

  const inputs = (intervention.context.inputs ?? {}) as Record<string, unknown>

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-amber-300" />
          <span className="text-sm font-semibold text-amber-200">
            Approval requested:{" "}
            <span className="font-mono">
              {intervention.context.capabilityId ?? "capability"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <KindPill kind={intervention.kind} />
          <StatusPill status={intervention.status} />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {intervention.reason}
      </p>

      <div className="grid gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
        <Row
          label="requested by"
          value={
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="size-3 text-muted-foreground" />
              {intervention.requestedBy ?? "engine"}
            </span>
          }
        />
        <Row
          label="decides"
          value={
            <span className="inline-flex items-center gap-1.5">
              <BotIcon className="size-3 text-emerald-300" />
              {sessionEmail ?? "you"}
            </span>
          }
        />
        <Row label="raised" value={formatDateTime(intervention.createdAt)} />
        {intervention.runId && (
          <Row
            label="run"
            value={
              <span className="font-mono">
                {intervention.runId.slice(0, 8)}…
              </span>
            }
          />
        )}
      </div>

      {Object.keys(inputs).length > 0 && <InputsTable inputs={inputs} />}

      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Decision reason (recorded as evidence)"
        aria-label="Decision reason"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="rounded-full"
          disabled={decide.isPending}
          onClick={() => decide.mutate(true)}
        >
          {decide.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <CheckCircle2Icon className="size-4" />
          )}
          Approve and run
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={decide.isPending}
          onClick={() => decide.mutate(false)}
        >
          <CircleSlashIcon className="size-4" />
          Reject
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

// ── Live-session take-over panel ─────────────────────────────────────────

type ActionKind = "click" | "type" | "select" | "press" | "navigate"

// Drives the SAME live session the automation was using: cede passes
// ownership to the signed-in operator, structured actions execute against
// the live page (recorded into evidence), resume hands control back.
const TakeoverPanel = ({
  intervention,
  sessionEmail,
}: {
  intervention: EngineIntervention
  sessionEmail: string | undefined
}) => {
  const runId = intervention.runId
  const queryClient = useQueryClient()
  const [control, setControl] = useState<{
    owner: "automation" | "human"
    paused: boolean
  } | null>(null)
  const [wsOpen, setWsOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionKind, setActionKind] = useState<ActionKind>("click")
  const [role, setRole] = useState("button")
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  const [keyName, setKeyName] = useState("Enter")
  const [navigateUrl, setNavigateUrl] = useState("")
  const controlRef = useRef<{
    send: (c: never) => void
    close: () => void
  } | null>(null)

  const operator = sessionEmail ?? "operator"

  const stateQuery = useQuery({
    ...sessionStateQuery(runId!),
    enabled: runId !== null,
  })

  // The control channel (WS) is the only way to pause/cede/resume; the
  // browser connects directly to the engine (see lib/engine/ws.ts).
  useEffect(() => {
    if (!runId) return
    const handle = connectEngineControl({
      onEvent: (message: EngineControlMessage) => {
        if (message.runId !== runId) return
        if (message.type === "control-state") {
          setControl({
            owner: message.owner ?? "automation",
            paused: message.paused ?? false,
          })
        }
        if (
          message.type === "run-finished" ||
          message.type === "session-closed" ||
          message.type === "human-action"
        ) {
          void queryClient.invalidateQueries({
            queryKey: ["engine", "session", runId],
          })
          void queryClient.invalidateQueries({ queryKey: ["engine", "runs"] })
          void queryClient.invalidateQueries({
            queryKey: ["engine", "interventions"],
          })
        }
      },
      onStateChange: setWsOpen,
    })
    controlRef.current = handle as never
    return () => handle.close()
  }, [runId, queryClient])

  const session: SessionState | undefined = stateQuery.data
  const owner = control?.owner ?? session?.owner ?? "automation"
  const paused = control?.paused ?? session?.paused ?? false
  const humanOwns = owner === "human"
  const sessionGone =
    stateQuery.isError &&
    !isEngineOffline(stateQuery.error) &&
    engineErrorMessage(stateQuery.error)
      .toLowerCase()
      .includes("no live session")

  const sendControl = (type: "pause" | "cede" | "resume") => {
    controlRef.current?.send({
      type,
      runId: runId!,
      operator,
      detail:
        type === "resume"
          ? "operator returned control to automation from the console"
          : undefined,
    } as never)
    // Optimistic: the broadcast control-state will confirm.
    if (type === "pause") setControl({ owner, paused: true })
    if (type === "cede") setControl({ owner: "human", paused: true })
    if (type === "resume") setControl({ owner: "automation", paused: false })
  }

  const doAction = useMutation({
    mutationFn: async () => {
      const body =
        actionKind === "navigate"
          ? { action: "navigate" as const, url: navigateUrl }
          : actionKind === "press"
            ? {
                action: "press" as const,
                key: keyName,
                role: role || undefined,
                name: name || undefined,
              }
            : { action: actionKind, role, name, value }
      return postSessionAction(runId!, body)
    },
    onSuccess: () => {
      setActionError(null)
      setName("")
      setValue("")
      void queryClient.invalidateQueries({
        queryKey: ["engine", "session", runId],
      })
    },
    onError: (failure) =>
      setActionError(
        failure instanceof Error ? failure.message : String(failure)
      ),
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Ownership bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <MonitorIcon className="size-3.5 text-emerald-300" />
          <span className="text-muted-foreground">live session</span>
          <span
            className={cn(
              pillBase,
              humanOwns
                ? "border-violet-400/25 bg-violet-400/10 text-violet-300"
                : "border-sky-400/25 bg-sky-400/10 text-sky-300"
            )}
          >
            {humanOwns ? `human: ${operator}` : "automation"}
          </span>
          {paused && !humanOwns && (
            <span
              className={cn(
                pillBase,
                "border-white/15 bg-white/[0.04] text-muted-foreground"
              )}
            >
              paused
            </span>
          )}
          <span
            className={cn(
              pillBase,
              wsOpen
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                : "border-red-400/25 bg-red-400/10 text-red-300"
            )}
          >
            {wsOpen ? "control channel open" : "control channel closed"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!wsOpen || humanOwns}
            onClick={() => sendControl("pause")}
          >
            <PauseIcon className="size-4" />
            Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!wsOpen || humanOwns}
            onClick={() => sendControl("cede")}
          >
            <HandIcon className="size-4" />
            Take control
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            disabled={!wsOpen || !humanOwns}
            onClick={() => sendControl("resume")}
          >
            <PlayIcon className="size-4" />
            Resume automation
          </Button>
        </div>
      </div>

      {sessionGone && (
        <EmptyState
          title="Live session closed"
          hint="The run finished and its browser session was torn down. The control log and human actions are preserved in the run evidence."
        />
      )}

      {!sessionGone && (
        <>
          {/* Live view */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className={monoEyebrow}>Screenshot</span>
              {session?.screenshotDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL from the engine, not a static asset
                <img
                  src={session.screenshotDataUrl}
                  alt="Live session screenshot"
                  className="rounded-lg border border-white/10"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/12 text-xs text-muted-foreground">
                  No screenshot yet
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className={monoEyebrow}>Accessibility tree</span>
              <pre className="max-h-64 overflow-auto rounded-lg border border-white/8 bg-white/[0.02] p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {session?.aria ?? "No snapshot yet"}
              </pre>
            </div>
          </div>

          <Row
            label="page url"
            value={<span className="font-mono">{session?.url ?? "…"}</span>}
          />

          {/* Manual steps — only while a human owns the session */}
          <div className="flex flex-col gap-3 rounded-lg border border-white/8 p-3">
            <span className={monoEyebrow}>
              Manual step (recorded as evidence)
            </span>
            {!humanOwns && (
              <p className="text-xs text-muted-foreground">
                Take control first — automation never races the operator on the
                same page.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">action</span>
                <select
                  value={actionKind}
                  onChange={(event) =>
                    setActionKind(event.target.value as ActionKind)
                  }
                  disabled={!humanOwns}
                  className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
                >
                  <option value="click">click</option>
                  <option value="type">type</option>
                  <option value="select">select</option>
                  <option value="press">press</option>
                  <option value="navigate">navigate</option>
                </select>
              </label>
              {actionKind !== "navigate" && actionKind !== "press" && (
                <>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">role</span>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={!humanOwns}
                      className="w-28"
                      placeholder="button"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">
                      accessible name
                    </span>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!humanOwns}
                      className="w-44"
                      placeholder="Continue"
                    />
                  </label>
                </>
              )}
              {(actionKind === "type" || actionKind === "select") && (
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">value</span>
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={!humanOwns}
                    className="w-32"
                    placeholder="50"
                  />
                </label>
              )}
              {actionKind === "press" && (
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">key</span>
                  <Input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    disabled={!humanOwns}
                    className="w-24"
                    placeholder="Enter"
                  />
                </label>
              )}
              {actionKind === "navigate" && (
                <label className="flex flex-1 flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">url</span>
                  <Input
                    value={navigateUrl}
                    onChange={(e) => setNavigateUrl(e.target.value)}
                    disabled={!humanOwns}
                    placeholder="/dashboard"
                  />
                </label>
              )}
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={!humanOwns || doAction.isPending}
                onClick={() => doAction.mutate()}
              >
                {doAction.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
                Perform
              </Button>
            </div>
            {actionError && (
              <p role="alert" className="text-xs text-red-400">
                {actionError}
              </p>
            )}
          </div>

          {/* Control log */}
          <div className="flex flex-col gap-1.5">
            <span className={monoEyebrow}>Control log</span>
            <div className="flex max-h-40 flex-col gap-1 overflow-auto rounded-lg border border-white/8 bg-white/[0.02] p-3">
              {(session?.controlLog ?? []).map((entry, index) => (
                <div key={index} className="flex items-baseline gap-2 text-xs">
                  <span className="shrink-0 font-mono text-muted-foreground/70">
                    {new Date(entry.at).toLocaleTimeString()}
                  </span>
                  <span className="font-medium text-foreground">
                    {entry.event}
                  </span>
                  {entry.detail && (
                    <span className="truncate text-muted-foreground">
                      {entry.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Stuck intervention card ──────────────────────────────────────────────

const StuckCard = ({
  intervention,
  sessionEmail,
}: {
  intervention: EngineIntervention
  sessionEmail: string | undefined
}) => {
  const context = intervention.context
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HandIcon className="size-4 text-violet-300" />
          <span className="text-sm font-semibold text-violet-200">
            Automation stuck — take over the live session
          </span>
        </div>
        <div className="flex items-center gap-2">
          <KindPill kind={intervention.kind} />
          <StatusPill status={intervention.status} />
        </div>
      </div>

      <div className="grid gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
        {context.capabilityId && (
          <Row
            label="capability"
            value={<span className="font-mono">{context.capabilityId}</span>}
          />
        )}
        {context.goal && <Row label="goal" value={context.goal} />}
        {context.stepIndex !== undefined && (
          <Row label="step" value={context.stepIndex} />
        )}
        {context.intent && <Row label="intent" value={context.intent} />}
        <Row label="reason" value={intervention.reason} />
        <Row label="raised" value={formatDateTime(intervention.createdAt)} />
      </div>

      {intervention.runId && (
        <TakeoverPanel
          intervention={intervention}
          sessionEmail={sessionEmail}
        />
      )}
    </div>
  )
}

// ── Decided history row ──────────────────────────────────────────────────

const HistoryRow = ({ intervention }: { intervention: EngineIntervention }) => {
  const context = intervention.context
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KindPill kind={intervention.kind} />
          <StatusPill status={intervention.status} />
          {context.capabilityId && (
            <span className="font-mono text-xs text-foreground">
              {context.capabilityId}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(intervention.resolvedAt ?? intervention.createdAt)}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {intervention.reason}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/80">
        <span>
          requested by{" "}
          <span className="font-mono text-foreground">
            {intervention.requestedBy ?? "engine"}
          </span>
        </span>
        <span>
          decided by{" "}
          <span className="font-mono text-foreground">
            {intervention.decidedBy ?? "—"}
          </span>
        </span>
        {context.selfApproved && (
          <span
            className={cn(
              pillBase,
              "border-amber-400/25 bg-amber-400/10 text-amber-300"
            )}
          >
            self-approved
          </span>
        )}
        {intervention.decisionReason && (
          <span className="italic">“{intervention.decisionReason}”</span>
        )}
      </div>
    </div>
  )
}

// ── The inbox ────────────────────────────────────────────────────────────

export const InterventionsInbox = () => {
  const interventions = useQuery(interventionsQuery())
  const { data: session } = authClient.useSession()
  const sessionEmail = session?.user.email

  const { pending, decided } = useMemo(() => {
    const all = interventions.data ?? []
    return {
      pending: all.filter((i) => i.status === "pending"),
      decided: all.filter((i) => i.status !== "pending"),
    }
  }, [interventions.data])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <span className={monoEyebrow}>Automation console</span>
        <h1 className="text-2xl font-semibold tracking-tight">Interventions</h1>
        <p className="text-sm text-muted-foreground">
          When automation is stuck or needs a human decision, it raises a
          request here. Approvals are decided by a DIFFERENT operator than the
          requester; stuck runs hand you the same live session to fix and
          return. New requests appear automatically.
        </p>
      </div>

      {interventions.isPending && <LoadingRows rows={3} />}
      {interventions.isError &&
        (isEngineOffline(interventions.error) ? (
          <EngineOfflineBanner
            reason={engineErrorMessage(interventions.error)}
          />
        ) : (
          <EngineErrorBanner reason={engineErrorMessage(interventions.error)} />
        ))}

      {interventions.isSuccess && pending.length === 0 && (
        <EmptyState
          title="Inbox zero"
          hint="No pending requests. Risky capability invocations (from the caller chat or the engine) and stuck runs raise interventions here."
        />
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-4">
          {pending.map((intervention) =>
            intervention.kind === "approval" ? (
              <ApprovalCard
                key={intervention.id}
                intervention={intervention}
                sessionEmail={sessionEmail}
              />
            ) : (
              <StuckCard
                key={intervention.id}
                intervention={intervention}
                sessionEmail={sessionEmail}
              />
            )
          )}
        </div>
      )}

      {decided.length > 0 && (
        <Section eyebrow="Decided">
          <div className="flex flex-col gap-2.5">
            {decided.map((intervention) => (
              <HistoryRow key={intervention.id} intervention={intervention} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
