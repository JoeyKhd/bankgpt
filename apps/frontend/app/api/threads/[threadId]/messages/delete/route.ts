import { z } from "zod"

import { deleteMessages, getThread } from "@/lib/chat-threads"
import { requireSession } from "@/lib/require-session"

type Params = { params: Promise<{ threadId: string }> }

const deleteBodySchema = z.object({
  ids: z.array(z.string().min(1).max(100)).min(1).max(500),
})

export const POST = async (req: Request, { params }: Params) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId } = await params
  if (!getThread(threadId, session.user.id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const parsed = deleteBodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  deleteMessages(threadId, parsed.data.ids)
  return new Response(null, { status: 204 })
}
