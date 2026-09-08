// Curated OpenRouter model catalog for the caller-simulation chat.
// Verified against the live OpenRouter catalog (https://openrouter.ai/api/v1/models)
// on 2026-09-08: every entry supports `tools` and `reasoning`/`reasoning_effort`.
// The server validates client-supplied model ids against this list, so adding a
// model here is the only change needed to offer it in the UI.

export type ChatModel = {
  /** OpenRouter model id, e.g. "anthropic/claude-sonnet-4.6". */
  id: string
  /** Short display name. */
  name: string
  /** One-line capability note shown in the picker. */
  description: string
}

export const CHAT_MODELS: readonly ChatModel[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    description: "OpenAI — open-weight reasoning model, ultra-low cost",
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    description: "Anthropic — balanced all-rounder, strong tool use",
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    description: "Anthropic — deepest reasoning, highest cost",
  },
  {
    id: "openai/gpt-5.4",
    name: "GPT-5.4",
    description: "OpenAI — frontier general-purpose model",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    description: "Google — long context, strong multimodal",
  },
  {
    id: "x-ai/grok-4.6",
    name: "Grok 4.6",
    description: "xAI — fast frontier model",
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    description: "DeepSeek — low-cost open model",
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
