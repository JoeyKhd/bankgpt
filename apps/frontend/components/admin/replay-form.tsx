"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { ArrowRightIcon, Loader2Icon, PlayIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { z } from "zod"

import {
  EngineErrorBanner,
  EngineOfflineBanner,
  Section,
} from "@/components/admin/engine-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  engineKeys,
  engineErrorMessage,
  isEngineOffline,
  startReplay,
  type CapabilityInput,
  type EngineCapability,
} from "@/lib/engine"

// Form values stay strings (inputs render text); conversion to the typed
// replay inputs happens on submit. Optional fields left empty are omitted.
type ReplayValues = Record<string, string>

const inputValidator = (input: CapabilityInput) => {
  if (input.type === "boolean") {
    return z
      .string()
      .refine(
        (v) => (v === "" ? !input.required : v === "true" || v === "false"),
        {
          message: "required — pick true or false",
        }
      )
  }
  if (input.type === "number") {
    return z
      .string()
      .refine((v) => (v === "" ? !input.required : !Number.isNaN(Number(v))), {
        message: input.required
          ? "required — must be a number"
          : "must be a number",
      })
  }
  if (input.type === "enum") {
    const allowed = input.values ?? []
    return z
      .string()
      .refine((v) => (v === "" ? !input.required : allowed.includes(v)), {
        message: "required — pick one of the allowed values",
      })
  }
  return input.required ? z.string().min(1, "required") : z.string()
}

const toTypedInputs = (inputs: CapabilityInput[], values: ReplayValues) => {
  const typed: Record<string, string | number | boolean> = {}
  for (const input of inputs) {
    const raw = values[input.name] ?? ""
    if (raw === "") continue
    if (input.type === "number") {
      typed[input.name] = Number(raw)
    } else if (input.type === "boolean") {
      typed[input.name] = raw === "true"
    } else {
      typed[input.name] = raw
    }
  }
  return typed
}

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export const ReplayForm = ({
  capability,
}: {
  capability: EngineCapability
}) => {
  const queryClient = useQueryClient()
  const [runId, setRunId] = useState<string | null>(null)
  const { artifact } = capability

  const replay = useMutation({
    mutationFn: startReplay,
    onSuccess: (data) => {
      setRunId(data.runId)
      queryClient.invalidateQueries({ queryKey: engineKeys.runs() })
    },
  })

  const form = useForm({
    defaultValues: Object.fromEntries(
      artifact.inputs.map((input) => [input.name, ""])
    ) as ReplayValues,
    onSubmit: async ({ value }) => {
      replay.mutate({
        capabilityId: artifact.id,
        inputs: toTypedInputs(artifact.inputs, value),
      })
    },
  })

  const gated = artifact.risk === "risky" && !capability.reviewed

  return (
    <Section eyebrow="Replay">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Run the recorded steps against {artifact.targetApp} with fresh input
        values. The engine answers 202 with a run id and executes in the
        background.
      </p>

      {gated && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
          This capability is risky and unreviewed — the engine will refuse the
          replay until it is marked reviewed above.
        </p>
      )}

      {artifact.inputs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No typed inputs — this replay takes no parameters.
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {artifact.inputs.map((input) => (
              <form.Field
                key={input.name}
                name={input.name}
                validators={{ onChange: inputValidator(input) }}
              >
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={field.name}
                      className="flex items-baseline gap-1.5 text-xs font-medium"
                    >
                      <span className="font-mono">{input.name}</span>
                      <span className="text-muted-foreground/70">
                        {input.type}
                        {input.required ? " · required" : " · optional"}
                      </span>
                    </label>
                    {input.type === "boolean" || input.type === "enum" ? (
                      <select
                        id={field.name}
                        name={field.name}
                        className={fieldClass}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      >
                        <option value="">
                          {input.required ? "Select…" : "Omit"}
                        </option>
                        {(input.type === "boolean"
                          ? ["true", "false"]
                          : (input.values ?? [])
                        ).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={field.name}
                        name={field.name}
                        inputMode={
                          input.type === "number" ? "decimal" : undefined
                        }
                        placeholder={input.description}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {input.description}
                    </span>
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0 && (
                        <span className="text-xs text-red-300">
                          {field.state.meta.errors
                            .map((err) =>
                              typeof err === "string" ? err : err?.message
                            )
                            .join(", ")}
                        </span>
                      )}
                  </div>
                )}
              </form.Field>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-full"
                  disabled={!canSubmit || isSubmitting || replay.isPending}
                >
                  {replay.isPending || isSubmitting ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <PlayIcon />
                  )}
                  Start replay
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      )}

      {artifact.inputs.length === 0 && (
        <div>
          <Button
            size="sm"
            className="rounded-full"
            disabled={replay.isPending}
            onClick={() =>
              replay.mutate({ capabilityId: artifact.id, inputs: {} })
            }
          >
            {replay.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <PlayIcon />
            )}
            Start replay
          </Button>
        </div>
      )}

      {replay.isError &&
        (isEngineOffline(replay.error) ? (
          <EngineOfflineBanner reason={engineErrorMessage(replay.error)} />
        ) : (
          <EngineErrorBanner
            title="Replay refused"
            reason={engineErrorMessage(replay.error)}
          />
        ))}

      {runId && (
        <Link
          href={`/admin/runs/${encodeURIComponent(runId)}`}
          className="group flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4 transition-colors hover:border-emerald-400/40"
        >
          <span className="text-sm text-emerald-200">
            Replay started — follow the run live
          </span>
          <ArrowRightIcon className="size-4 text-emerald-300 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </Section>
  )
}
