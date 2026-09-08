"use client"

import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
  Tools,
} from "@assistant-ui/react"
import { useChatRuntime, useThreadTokenUsage } from "@assistant-ui/ai-sdk"
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai"
import { LayoutDashboardIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { Thread } from "@/components/assistant-ui/elements/thread.aui"
import { ModelSelector } from "@/components/assistant-ui/elements/model-selector.aui"
import { CHAT_MODELS, DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models"

import toolkit from "./toolkit"

const monoEyebrow =
  "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300/80"

const TokenUsage = () => {
  const usage = useThreadTokenUsage()
  if (!usage) return null
  return (
    <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
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
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
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
      <div className="flex h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/bankgpt-mark.svg"
              alt="BankGPT"
              width={28}
              height={28}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                BankGPT Caller
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                Simulated calling agent — capability invocation only
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-emerald-400/25 hover:text-foreground"
            >
              <LayoutDashboardIcon className="size-3.5" />
              Console
            </Link>
            <TokenUsage />
            <ModelSelector
              models={CHAT_MODELS.map((model) => ({
                id: model.id,
                name: model.name,
                description: model.description,
                efforts: true,
              }))}
              defaultValue={DEFAULT_CHAT_MODEL_ID}
              searchable
            />
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <Thread components={{ Welcome }} />
        </div>
      </div>
    </AssistantRuntimeProvider>
  )
}
