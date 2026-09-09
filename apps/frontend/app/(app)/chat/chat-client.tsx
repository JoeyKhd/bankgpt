"use client"

import { useState, type ComponentType } from "react"
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
  Tools,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react"
import { useChatRuntime } from "@assistant-ui/ai-sdk"
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai"
import { LayoutDashboardIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { EngineProviders } from "@/components/admin/engine-providers"
import { Thread } from "@/components/assistant-ui/elements/thread.aui"
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui"
import { ModelSelector } from "@/components/assistant-ui/elements/model-selector.aui"
import {
  AnthropicIcon,
  DeepSeekIcon,
  GeminiIcon,
  OpenAIIcon,
  XAIIcon,
  ZAIIcon,
} from "@/components/assistant-ui/elements/model-icons"
import { CHAT_MODELS, DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models"
import { CHAT_SUGGESTIONS } from "@/lib/chat-suggestions"
import { threadListAdapter } from "@/lib/thread-list-adapter"
import { createDictationAdapter } from "@/lib/dictation"
import { useEngineEventInvalidation } from "@/lib/engine"
import { useMounted } from "@/hooks/use-mounted"

import toolkit from "./toolkit"

const monoEyebrow =
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-emerald-300/80"

const PROVIDER_ICONS: Record<string, ComponentType> = {
  anthropic: AnthropicIcon,
  openai: OpenAIIcon,
  google: GeminiIcon,
  "x-ai": XAIIcon,
  deepseek: DeepSeekIcon,
  "z-ai": ZAIIcon,
}

const MODEL_OPTIONS = CHAT_MODELS.map((model) => {
  const Icon = PROVIDER_ICONS[model.id.split("/")[0] ?? ""]
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    efforts: true as const,
    ...(Icon ? { icon: <Icon /> } : {}),
  }
})

const MODEL_STORAGE_KEY = "bankgpt.chat.model"
const EFFORT_STORAGE_KEY = "bankgpt.chat.effort"

// Model + effort picker rendered inside the composer, next to attachments.
// The wrapper renders a zero-size placeholder during SSR and the first client
// render (identical markup), then swaps in the real selector after mount, so
// localStorage is only ever read on the post-hydration render — never on the
// SSR/first-client pass. That keeps hydration clean; anything that reads
// client-only values must stay behind this gate.
const ComposerModelSelector = () => {
  const mounted = useMounted()
  if (!mounted) return <span className="inline-block size-7" aria-hidden />
  return <ComposerModelSelectorInner />
}

const readStoredModel = () => {
  const stored = localStorage.getItem(MODEL_STORAGE_KEY)
  return stored && MODEL_OPTIONS.some((m) => m.id === stored)
    ? stored
    : DEFAULT_CHAT_MODEL_ID
}

const readStoredEffort = () => {
  const stored = localStorage.getItem(EFFORT_STORAGE_KEY)
  return stored === "low" || stored === "medium" || stored === "high"
    ? stored
    : "low"
}

const ComposerModelSelectorInner = () => {
  const [model, setModel] = useState<string>(readStoredModel)
  const [effort, setEffort] = useState<string>(readStoredEffort)

  return (
    <ModelSelector
      models={MODEL_OPTIONS}
      value={model}
      onValueChange={(next) => {
        setModel(next)
        localStorage.setItem(MODEL_STORAGE_KEY, next)
      }}
      effort={effort}
      onEffortChange={(next) => {
        setEffort(next)
        localStorage.setItem(EFFORT_STORAGE_KEY, next)
      }}
      variant="ghost"
      size="sm"
      className="rounded-full"
      searchable
    />
  )
}

const Welcome = () => (
  <div className="mb-8 flex flex-col items-center gap-4 px-4 text-center">
    <span className={monoEyebrow}>Caller simulation</span>
    <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-balance">
      Delegate work to the{" "}
      <span className="bg-[linear-gradient(105deg,#6366F1,#8B5CF6_42%,#10B981)] bg-clip-text text-transparent">
        automation layer
      </span>
    </h1>
    <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
      You are talking to the calling agent — the BankGPT side. It decides what
      needs doing and invokes saved capabilities; the engine replays them in the
      target app with no model in the loop.
    </p>
  </div>
)

// The invoke tool's phase-one marker shape — see lib/engine/invoke.ts.
const isApprovalPendingOutput = (output: unknown): boolean => {
  if (typeof output !== "object" || output === null) return false
  const result = output as { source?: unknown; live?: { kind?: unknown } }
  return result.source === "live" && result.live?.kind === "approval_pending"
}

// Hold the turn while an invoke_capability result is the approval_pending
// marker: the request is raised, not finished, and the approval card
// completes the call (addResult) with the real outcome once the operator
// decides. Auto-sending on the marker would add a throwaway "waiting"
// reply whose step-start boundary then BLOCKS the outcome's auto-send.
const sendAutomaticallyWhen = ({ messages }: { messages: UIMessage[] }) => {
  if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) return false
  return !messages
    .at(-1)
    ?.parts.some(
      (part) =>
        part.type === "tool-invoke_capability" &&
        part.state === "output-available" &&
        isApprovalPendingOutput(part.output)
    )
}

// Engine lifecycle broadcasts (intervention raised/decided, run finished)
// invalidate the matching queries — the approval card flips the moment an
// operator decides instead of waiting for the next poll. Rendered as an
// inner component because the hook needs the query client, which
// EngineProviders only supplies to its CHILDREN.
const EngineEventInvalidation = () => {
  useEngineEventInvalidation()
  return null
}

export const ChatClient = () => {
  const runtime = useRemoteThreadListRuntime({
    adapter: threadListAdapter,
    runtimeHook: function useChatThreadRuntime() {
      // The approval gate was removed (D-046: segregated operator approval
      // inside the invoke tool, never the requester), so auto-send after any
      // completed tool call — frontend tool results must round-trip to the
      // model without a manual nudge. The one exception is the invoke
      // tool's approval_pending marker (D-056 two-phase approvals).
      return useChatRuntime({
        sendAutomaticallyWhen,
        adapters: { dictation: createDictationAdapter() },
      })
    },
  })

  const config = AuiConfig({
    tools: Tools({ toolkit }),
    suggestions: Suggestions(CHAT_SUGGESTIONS),
  })

  return (
    <EngineProviders>
      <EngineEventInvalidation />
      <AssistantRuntimeProvider runtime={runtime} config={config}>
        <div className="flex h-dvh">
          <aside className="hidden w-64 shrink-0 flex-col border-r border-white/6 bg-card/40 sm:flex">
            <div className="flex items-center gap-2.5 border-b border-white/6 px-4 py-3">
              <Image
                src="/bankgpt-mark.svg"
                alt="BankGPT"
                width={40}
                height={24}
                className="shrink-0"
              />
              <span className="truncate text-sm font-semibold">BankGPT</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <ThreadList />
            </div>
            <div className="border-t border-white/6 p-2">
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboardIcon className="size-4" />
                Console
              </Link>
            </div>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <Thread
                components={{ Welcome, ComposerLeft: ComposerModelSelector }}
              />
            </div>
          </main>
        </div>
      </AssistantRuntimeProvider>
    </EngineProviders>
  )
}
