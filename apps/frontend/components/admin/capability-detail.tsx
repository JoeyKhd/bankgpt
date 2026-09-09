"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  Loader2Icon,
  ShieldAlertIcon,
} from "lucide-react"
import Link from "next/link"

import {
  EngineErrorBanner,
  EngineOfflineBanner,
  LoadingRows,
  ReviewedPill,
  RiskPill,
  Section,
  formatDateTime,
  monoEyebrow,
} from "@/components/admin/engine-ui"
import { ReplayForm } from "@/components/admin/replay-form"
import { Button } from "@/components/ui/button"
import {
  capabilityQuery,
  engineKeys,
  engineErrorMessage,
  isEngineOffline,
  markCapabilityReviewed,
  type Checkpoint,
  type EngineCapability,
  type Locator,
} from "@/lib/engine"

// ── Contract renderers ───────────────────────────────────────────────────

const describeLocator = (locator: Locator): string => {
  if (locator.strategy === "a11y") {
    const bits = [locator.role, locator.name && `"${locator.name}"`]
      .filter(Boolean)
      .join(" ")
    return `a11y: ${bits || "any role"}${locator.exact ? "" : " (contains)"}`
  }
  if (locator.strategy === "css") return `css: ${locator.css ?? ""}`
  return `text: "${locator.text ?? ""}"${locator.exact ? "" : " (contains)"}`
}

const describeCheckpoint = (checkpoint: Checkpoint): string[] => {
  const parts: string[] = []
  if (checkpoint.urlPattern) parts.push(`URL matches ${checkpoint.urlPattern}`)
  if (checkpoint.visibleText)
    parts.push(`page shows "${checkpoint.visibleText}"`)
  if (checkpoint.elementPresent)
    parts.push(
      `element present: ${describeLocator(checkpoint.elementPresent.primary)}`
    )
  if (checkpoint.timeoutMs) parts.push(`within ${checkpoint.timeoutMs}ms`)
  return parts
}

const FieldRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-2 text-xs">
    <span className="w-24 shrink-0 font-mono text-muted-foreground/70">
      {label}
    </span>
    <span className="font-mono break-all text-foreground/90">{value}</span>
  </div>
)

// ── Sections ─────────────────────────────────────────────────────────────

const StepsSection = ({ capability }: { capability: EngineCapability }) => (
  <Section eyebrow={`Steps · ${capability.artifact.steps.length}`}>
    <ol className="flex flex-col gap-3">
      {capability.artifact.steps.map((step, i) => (
        <li
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-white/6 bg-white/[0.02] p-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 font-mono text-xs font-medium text-emerald-300">
              {i + 1}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {step.action}
            </span>
            <span className="text-sm">{step.intent}</span>
          </div>

          {step.target && (
            <div className="flex flex-col gap-1 border-l-2 border-white/8 pl-3">
              <FieldRow
                label="primary"
                value={describeLocator(step.target.primary)}
              />
              {step.target.fallbacks.map((fallback, j) => (
                <FieldRow
                  key={j}
                  label={`fallback ${j + 1}`}
                  value={describeLocator(fallback)}
                />
              ))}
              <FieldRow label="robustness" value={step.target.robustness} />
            </div>
          )}

          <div className="flex flex-col gap-1">
            {step.input !== undefined && (
              <FieldRow label="input" value={step.input} />
            )}
            {step.value !== undefined && (
              <FieldRow label="value" value={step.value} />
            )}
            {step.url !== undefined && (
              <FieldRow label="url" value={step.url} />
            )}
            {step.key !== undefined && (
              <FieldRow label="key" value={step.key} />
            )}
            {step.outputName !== undefined && (
              <FieldRow
                label="extracts to"
                value={`${step.outputName}${
                  step.extractKind ? ` (${step.extractKind})` : ""
                }`}
              />
            )}
            {step.pattern !== undefined && (
              <FieldRow label="pattern" value={step.pattern} />
            )}
          </div>

          {step.checkpoint && (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span className="font-mono text-emerald-300/80">checkpoint</span>
              {describeCheckpoint(step.checkpoint).map((part, j) => (
                <span key={j}>· {part}</span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  </Section>
)

const IoSection = ({ capability }: { capability: EngineCapability }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <Section eyebrow={`Inputs · ${capability.artifact.inputs.length}`}>
      {capability.artifact.inputs.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          No typed inputs — replays take no parameters.
        </span>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {capability.artifact.inputs.map((input) => (
            <li key={input.name} className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm">{input.name}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {input.type}
                  {input.values ? `: ${input.values.join(" | ")}` : ""}
                </span>
                {!input.required && (
                  <span className="text-xs text-muted-foreground/70">
                    optional
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {input.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
    <Section eyebrow={`Outputs · ${capability.artifact.outputs.length}`}>
      {capability.artifact.outputs.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          No typed outputs — the run produces no extracted values.
        </span>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {capability.artifact.outputs.map((output) => (
            <li key={output.name} className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm">{output.name}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {output.type}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {output.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  </div>
)

const OutcomeSection = ({ capability }: { capability: EngineCapability }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <Section eyebrow="Success checkpoint">
      <ul className="flex flex-col gap-1 text-sm">
        {describeCheckpoint(capability.artifact.checkpoint).map((part, i) => (
          <li key={i}>· {part}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        A replay only reports success when every condition holds.
      </p>
    </Section>
    <Section
      eyebrow={`Business outcomes · ${capability.artifact.businessOutcomes.length}`}
    >
      {capability.artifact.businessOutcomes.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          No expected business outcomes recorded — any off-path page is a
          failure, not a legitimate answer.
        </span>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {capability.artifact.businessOutcomes.map((outcome) => (
            <li key={outcome.code} className="flex flex-col gap-0.5">
              <span className="font-mono text-sm text-violet-300">
                {outcome.code}
              </span>
              <span className="text-xs text-muted-foreground">
                {outcome.description}
              </span>
              <span className="text-xs text-muted-foreground/70">
                detected when{" "}
                {[
                  outcome.detect.urlPattern &&
                    `URL matches ${outcome.detect.urlPattern}`,
                  outcome.detect.visibleText &&
                    `page shows "${outcome.detect.visibleText}"`,
                ]
                  .filter(Boolean)
                  .join(" and ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  </div>
)

// ── Page ─────────────────────────────────────────────────────────────────

export const CapabilityDetail = ({ id }: { id: string }) => {
  const queryClient = useQueryClient()
  const detail = useQuery(capabilityQuery(id))

  const review = useMutation({
    mutationFn: () => markCapabilityReviewed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: engineKeys.capabilities() })
    },
  })

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-8">
        <DetailHeader />
        <LoadingRows rows={3} />
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div className="flex flex-col gap-8">
        <DetailHeader />
        {isEngineOffline(detail.error) ? (
          <EngineOfflineBanner reason={engineErrorMessage(detail.error)} />
        ) : (
          <EngineErrorBanner reason={engineErrorMessage(detail.error)} />
        )}
      </div>
    )
  }

  const capability = detail.data
  const { artifact } = capability
  const gated = artifact.risk === "risky" && !capability.reviewed

  return (
    <div className="flex flex-col gap-8">
      <DetailHeader />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {artifact.name}
          </h1>
          <span className="font-mono text-sm text-muted-foreground">
            v{artifact.version}
          </span>
          <RiskPill risk={artifact.risk} />
          <ReviewedPill reviewed={capability.reviewed} />
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {artifact.description}
        </p>
        <div className="grid gap-x-8 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <span>
            Target app:{" "}
            <span className="text-foreground/90">{artifact.targetApp}</span>
          </span>
          <span>
            Goal: <span className="text-foreground/90">{artifact.goal}</span>
          </span>
          <span>Recorded {formatDateTime(artifact.createdAt)}</span>
          <span>
            Discovery model:{" "}
            <span className="font-mono">{artifact.discoveryModel}</span>
          </span>
        </div>
      </div>

      {!capability.reviewed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <div className="flex items-center gap-3">
            <ShieldAlertIcon className="size-4 shrink-0 text-amber-300" />
            <span className="text-xs leading-relaxed text-muted-foreground">
              {gated
                ? "Risky and unreviewed — the engine refuses to replay it until a human marks it reviewed."
                : "Unreviewed — confirm the steps below match what the capability should do."}
            </span>
          </div>
          <Button
            size="sm"
            className="rounded-full"
            disabled={review.isPending}
            onClick={() => review.mutate()}
          >
            {review.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <CircleCheckIcon />
            )}
            Mark reviewed
          </Button>
        </div>
      )}
      {review.isError && !isEngineOffline(review.error) && (
        <EngineErrorBanner
          title="Could not mark reviewed"
          reason={engineErrorMessage(review.error)}
        />
      )}
      {review.isError && isEngineOffline(review.error) && (
        <EngineOfflineBanner reason={engineErrorMessage(review.error)} />
      )}

      <IoSection capability={capability} />
      <StepsSection capability={capability} />
      <OutcomeSection capability={capability} />

      <ReplayForm capability={capability} />
    </div>
  )
}

const DetailHeader = () => (
  <div className="flex flex-col gap-1.5">
    <Link
      href="/admin/capabilities"
      className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon className="size-3.5" />
      All capabilities
    </Link>
    <span className={monoEyebrow}>Capability detail</span>
  </div>
)
