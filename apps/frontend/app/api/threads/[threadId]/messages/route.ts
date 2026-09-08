import { z } from "zod"

import { getThread, listMessages, putMessage } from "@/lib/chat-threads"
import { requireSession } from "@/lib/require-session"

type Params = { params: Promise<{ threadId: string }> }

export const GET = async (_req: Request, { params }: Params) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId } = await params
  if (!getThread(threadId, session.user.id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { headId, messages } = listMessages(threadId)
  return Response.json({
    headId,
    messages: messages.map((row) => ({
      id: row.message_id,
      parent_id: row.parent_id,
      format: row.format,
      content: JSON.parse(row.content) as unknown,
    })),
  })
}

const messageBodySchema = z.object({
  messageId: z.string().min(1).max(100),
  parentId: z.string().max(100).nullable(),
  format: z.string().min(1).max(50),
  // Encoded storage-format payload, JSON-serialized by the client adapter.
  content: z.string().min(2).max(2_000_000),
})

// Append or rewrite (upsert) one stored message for the thread.
export const POST = async (req: Request, { params }: Params) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId } = await params
  if (!getThread(threadId, session.user.id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const parsed = messageBodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  putMessage(threadId, parsed.data)
  return new Response(null, { status: 204 })
}
