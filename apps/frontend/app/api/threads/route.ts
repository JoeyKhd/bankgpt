import { z } from "zod"

import { createThread, listThreads, toThreadMetadata } from "@/lib/chat-threads"
import { requireSession } from "@/lib/require-session"

export const GET = async (req: Request) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const after = new URL(req.url).searchParams.get("after") ?? undefined
  const { threads, nextCursor } = listThreads(session.user.id, after)
  return Response.json({
    threads: threads.map(toThreadMetadata),
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  })
}

const createBodySchema = z.object({
  localId: z.string().max(100).optional(),
})

export const POST = async (req: Request) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = createBodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  const row = createThread(session.user.id, parsed.data.localId ?? null)
  return Response.json(toThreadMetadata(row))
}
