import type { SuggestionConfig } from "@assistant-ui/react"

/**
 * Seeded welcome suggestions for the caller-simulation chat.
 *
 * The suggestion model only carries { title, label, prompt } — there is no
 * custom-field channel to the item renderer — so a suggestion whose
 * capability is approval-gated is marked by setting its label to
 * APPROVAL_REQUIRED_LABEL; the thread renders that label as a badge instead
 * of plain secondary text. The constant lives here, shared between the
 * seeded list (chat-client) and the renderer (thread), so the two never
 * drift.
 */
export const APPROVAL_REQUIRED_LABEL = "Needs approval"

export const CHAT_SUGGESTIONS: SuggestionConfig[] = [
  {
    title: "List capabilities",
    label: "What can you do?",
    prompt: "What capabilities are available to you?",
  },
  {
    title: "Look up a member",
    label: "Member 100231 balances",
    prompt: "Look up member 100231 and read their current balances.",
  },
  {
    title: "Open a sub-account",
    label: APPROVAL_REQUIRED_LABEL,
    prompt:
      "Open a savings sub-account for member 100231 with an initial deposit of $250.",
  },
  {
    title: "Freeze a debit card",
    label: APPROVAL_REQUIRED_LABEL,
    prompt:
      "Freeze debit card ending 4412 for member 100231 — the card was lost.",
  },
  {
    title: "Money-market account",
    label: APPROVAL_REQUIRED_LABEL,
    prompt:
      "Open a money-market sub-account for member 100774 with an initial deposit of $1,000.",
  },
]
