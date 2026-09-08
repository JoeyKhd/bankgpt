// Curated OpenRouter model catalog for the caller-simulation chat.
// Verified against the live OpenRouter catalog (https://openrouter.ai/api/v1/models)
// on 2026-09-08: every entry supports `tools` and `reasoning`/`reasoning_effort`.
// The server validates client-supplied model ids against this list, so adding a
// model here is the only change needed to offer it in the UI.

export type ChatModel = {
  /** OpenRouter model id, e.g. "anthropic/claude-sonnet-4.6:nitro". */
  id: string
  /** Short display name. */
  name: string
  /** One-line capability note shown in the picker. */
  description: string
}

// Every id carries the `:nitro` routing variant — OpenRouter's throughput-sort
// shortcut, equivalent to `provider.sort: "throughput"`. Requests always land
// on the fastest live provider for the model, trading price for TPS (e.g.
// gpt-oss-120b nitro → Cerebras ~760 tok/s at ~$0.15/M in vs ~$0.037/M
// cheapest). Keep the suffix in sync across all entries.
export const CHAT_MODELS: readonly ChatModel[] = [
  {
    id: "openai/gpt-oss-120b:nitro",
    name: "GPT-OSS 120B",
    description: "OpenAI — open-weight reasoning model, ultra-low cost",
  },
  {
    id: "anthropic/claude-sonnet-4.6:nitro",
    name: "Claude Sonnet 4.6",
    description: "Anthropic — balanced all-rounder, strong tool use",
  },
  {
    id: "openai/gpt-oss-20b:nitro",
    name: "GPT-OSS 20B",
    description: "OpenAI — tiny open-weight model, fastest and cheapest",
  },
  {
    id: "z-ai/glm-5.3-flash:nitro",
    name: "GLM 5.3 Flash",
    description: "Z.AI — fast open model, top-ranked tool calling",
  },
  {
    id: "deepseek/deepseek-v4-flash:nitro",
    name: "DeepSeek V4 Flash",
    description: "DeepSeek — fast low-cost open model, 1M context",
  },
  {
    id: "anthropic/claude-haiku-4.5:nitro",
    name: "Claude Haiku 4.5",
    description: "Anthropic — fastest Claude, reliable tool use",
  },
] as const

// The first catalog entry is the default for new chats and server-side fallback.
export const DEFAULT_CHAT_MODEL_ID = CHAT_MODELS[0].id

export const isChatModelId = (id: string | undefined): id is string =>
  id !== undefined && CHAT_MODELS.some((model) => model.id === id)

export type ReasoningEffort = "low" | "medium" | "high"

export const REASONING_EFFORTS: readonly ReasoningEffort[] = [
  "low",
  "medium",
  "high",
] as const

export const isReasoningEffort = (
  value: string | undefined
): value is ReasoningEffort =>
  value !== undefined &&
  (REASONING_EFFORTS as readonly string[]).includes(value)
