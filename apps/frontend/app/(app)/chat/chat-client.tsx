"use client"

import { useState, useSyncExternalStore, type ComponentType } from "react"
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
  Tools,
  useRemoteThreadListRuntime,
  WebSpeechDictationAdapter,
  type DictationAdapter,
} from "@assistant-ui/react"
import { useChatRuntime, useThreadTokenUsage } from "@assistant-ui/ai-sdk"
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai"
import { LayoutDashboardIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { Thread } from "@/components/assistant-ui/elements/thread.aui"
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui"
import { ModelSelector } from "@/components/assistant-ui/elements/model-selector.aui"
import {
  AnthropicIcon,
  DeepSeekIcon,
  GeminiIcon,
  OpenAIIcon,
  XAIIcon,
} from "@/components/assistant-ui/elements/model-icons"
import { CHAT_MODELS, DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models"
import { threadListAdapter } from "@/lib/thread-list-adapter"

import toolkit from "./toolkit"

const monoEyebrow =
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-emerald-300/80"

const PROVIDER_ICONS: Record<string, ComponentType> = {
  anthropic: AnthropicIcon,
  openai: OpenAIIcon,
  google: GeminiIcon,
  "x-ai": XAIIcon,
  deepseek: DeepSeekIcon,
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

const subscribeNoop = () => () => {}

// undefined = not evaluated yet; null = evaluated, unsupported.
let cachedDictation: DictationAdapter | null | undefined

const readDictation = (): DictationAdapter | undefined => {
  if (cachedDictation === undefined) {
    cachedDictation = WebSpeechDictationAdapter.isSupported()
      ? new WebSpeechDictationAdapter()
      : null
  }
  return cachedDictation ?? undefined
}

// Hydration-safe read of a client-only value: the server snapshot is the
// fallback, the real value appears on the first client re-render.
const useClientValue = <T,>(read: () => T, serverValue: T): T =>
  useSyncExternalStore(subscribeNoop, read, () => serverValue)

const readStoredModel = () => {
  const stored = localStorage.getItem(MODEL_STORAGE_KEY)
  return stored && MODEL_OPTIONS.some((m) => m.id === stored) ? stored : null
}

// Model + effort picker rendered inside the composer, next to attachments.
// The selection registers itself with the thread's model context; the last
// choice is restored from localStorage.
const ComposerModelSelector = () => {
  // Explicit choice this session wins; localStorage is the fallback.
  const [chosenModel, setChosenModel] = useState<string | null>(null)
  const [chosenEffort, setChosenEffort] = useState<string | null>(null)
  const storedModel = useClientValue(readStoredModel, null)
  const storedEffort = useClientValue(
    () => localStorage.getItem(EFFORT_STORAGE_KEY),
    null
  )

  const model = chosenModel ?? storedModel ?? DEFAULT_CHAT_MODEL_ID
  const effort = chosenEffort ?? storedEffort

  return (
    <ModelSelector
      models={MODEL_OPTIONS}
      value={model}
      onValueChange={(next) => {
        setChosenModel(next)
        localStorage.setItem(MODEL_STORAGE_KEY, next)
      }}
      {...(effort != null
        ? {
            effort,
            onEffortChange: (next: string) => {
              setChosenEffort(next)
              localStorage.setItem(EFFORT_STORAGE_KEY, next)
            },
          }
        : {})}
      variant="ghost"
      size="sm"
      className="rounded-full"
      searchable
    />
  )
}

const TokenUsage = () => {
  const usage = useThreadTokenUsage()
  if (!usage) return null
  return (
    <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-xs text-muted-foreground">
      {(usage.totalTokens ?? 0).toLocaleString()} tokens
    </span>
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

export const ChatClient = () => {
  // Browser SpeechRecognition is client-only; the SSR/first client render
  // must agree (no mic), so the adapter appears only after hydration.
  const dictation = useClientValue<DictationAdapter | undefined>(
    readDictation,
    undefined
  )

  const runtime = useRemoteThreadListRuntime({
    adapter: threadListAdapter,
    runtimeHook: function useChatThreadRuntime() {
      return useChatRuntime({
        sendAutomaticallyWhen:
          lastAssistantMessageIsCompleteWithApprovalResponses,
        adapters: { ...(dictation ? { dictation } : {}) },
      })
    },
  })

  const config = AuiConfig({
    tools: Tools({ toolkit }),
    suggestions: Suggestions([
      {
        title: "List capabilities",
        label: "What can you do?",
        prompt: "What capabilities are available to you?",
      },
      {
        title: "Look up a member",
        label: "Member 12345 balances",
        prompt: "Look up member 12345 and read their current balances.",
      },
      {
        title: "Open a sub-account",
        label: "Needs approval",
        prompt:
          "Open a savings sub-account for member 12345 with an initial deposit of $250.",
      },
    ]),
  })

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <div className="flex h-dvh">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/6 bg-card/40 sm:flex">
          <div className="flex items-center gap-2.5 border-b border-white/6 px-4 py-3">
            <Image
              src="/bankgpt-mark.svg"
              alt="BankGPT"
              width={24}
              height={24}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                BankGPT Caller
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Capability invocation only
              </span>
            </div>
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
          <header className="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3 sm:px-6">
            <span className={monoEyebrow}>Caller simulation</span>
            <TokenUsage />
          </header>
          <div className="min-h-0 flex-1">
            <Thread
              components={{ Welcome, ComposerLeft: ComposerModelSelector }}
            />
          </div>
        </main>
      </div>
    </AssistantRuntimeProvider>
  )
}
