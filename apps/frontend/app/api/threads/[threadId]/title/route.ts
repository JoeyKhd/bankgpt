import { createAssistantStreamResponse } from "assistant-stream"
import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { z } from "zod"

import { getThread } from "@/lib/chat-threads"
import { requireSession } from "@/lib/require-session"

export const maxDuration = 30

const openrouter = createOpenRouter()

// Cheap model for titles; the chat's model choice stays with the user.
const TITLE_MODEL = "deepseek/deepseek-v3.2"

const textOf = (message: unknown): string => {
  if (typeof message !== "object" || message === null) return ""
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return ""
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
    )
    .map((part) => part.text)
    .join("\n")
}

const bodySchema = z.object({
  messages: z.array(z.unknown()).min(1).max(20),
})

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId } = await params
  if (!getThread(threadId, session.user.id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 500 }
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  const transcript = parsed.data.messages
    .map((message) => {
      const role = (message as { role?: unknown }).role
      const text = textOf(message).slice(0, 800)
      return text ? `${role}: ${text}` : ""
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000)

  return createAssistantStreamResponse(async (controller) => {
    const { text } = await generateText({
      model: openrouter(TITLE_MODEL, {
        extraBody: { reasoning: { effort: "low" } },
      }),
      prompt: `Write a conversation title of at most 6 words for this transcript. Reply with the title only — no quotes, no trailing punctuation.\n\n${transcript}`,
    })
    controller.appendText(text.trim().split("\n")[0] ?? "New Chat")
  })
}
