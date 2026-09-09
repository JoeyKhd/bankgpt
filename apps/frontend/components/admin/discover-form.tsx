"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { Loader2Icon, RadarIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { z } from "zod"

import {
  EngineErrorBanner,
  EngineOfflineBanner,
  Section,
  monoEyebrow,
} from "@/components/admin/engine-ui"
import { RunDetail } from "@/components/admin/run-detail"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  engineKeys,
  engineErrorMessage,
  isEngineOffline,
  startDiscovery,
} from "@/lib/engine"

export const DiscoverForm = () => {
  const queryClient = useQueryClient()
  const [runId, setRunId] = useState<string | null>(null)

  const discover = useMutation({
    mutationFn: startDiscovery,
    onSuccess: (data) => {
      setRunId(data.runId)
      queryClient.invalidateQueries({ queryKey: engineKeys.runs() })
    },
  })

  const form = useForm({
    defaultValues: { goal: "", targetUrl: "", model: "" },
    onSubmit: async ({ value }) => {
      discover.mutate({
        goal: value.goal.trim(),
        targetUrl: value.targetUrl.trim(),
        model: value.model.trim() || undefined,
      })
    },
  })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <span className={monoEyebrow}>Automation console</span>
        <h1 className="text-2xl font-semibold tracking-tight">Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Hand the engine a goal and a target app; it learns the flow by driving
          the UI, then saves it as a reusable capability.
        </p>
      </div>

      <Section eyebrow="New discovery run" className="max-w-3xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Field
            name="goal"
            validators={{ onChange: z.string().min(1, "required") }}
          >
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={field.name} className="text-xs font-medium">
                  Goal
                </label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  placeholder="e.g. Find the current balance of the primary chequing account"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
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

          <form.Field
            name="targetUrl"
            validators={{
              onChange: z.url({
                protocol: /^https?$/,
                error: "must be an http(s) URL",
              }),
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={field.name} className="text-xs font-medium">
                  Target URL
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="https://bank.example.com/login"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
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

          <form.Field name="model" validators={{ onChange: z.string() }}>
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={field.name} className="text-xs font-medium">
                  Model{" "}
                  <span className="font-normal text-muted-foreground/70">
                    optional — engine default when empty
                  </span>
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="e.g. anthropic/claude-sonnet-4"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <div>
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
                  disabled={!canSubmit || isSubmitting || discover.isPending}
                >
                  {discover.isPending || isSubmitting ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <RadarIcon />
                  )}
                  Start discovery
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>

        {discover.isError &&
          (isEngineOffline(discover.error) ? (
            <EngineOfflineBanner reason={engineErrorMessage(discover.error)} />
          ) : (
            <EngineErrorBanner
              title="Discovery refused"
              reason={engineErrorMessage(discover.error)}
            />
          ))}
      </Section>

      {runId && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className={monoEyebrow}>Run {runId} started</span>
            <p className="text-xs text-muted-foreground">
              Watching live — the run polls every 2s and step evidence streams
              in as it lands. It is also listed under{" "}
              <Link
                className="text-emerald-300 hover:underline"
                href={`/admin/runs/${encodeURIComponent(runId)}`}
              >
                Runs
              </Link>
              .
            </p>
          </div>
          <RunDetail runId={runId} />
        </div>
      )}
    </div>
  )
}
