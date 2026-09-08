import { z } from "zod"

import {
  deleteThread,
  getThread,
  renameThread,
  setThreadStatus,
  toThreadMetadata,
} from "@/lib/chat-threads"
import { requireSession } from "@/lib/require-session"

type Params = { params: Promise<{ threadId: string }> }

export const GET = async (_req: Request, { params }: Params) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId } = await params
  const row = getThread(threadId, session.user.id)
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  return Response.json(toThreadMetadata(row))
}

const patchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["regular", "archived"]).optional(),
  })
  .refine((v) => v.title !== undefined || v.status !== undefined, {
    message: "Nothing to update",
  })

export const PATCH = async (req: Request, { params }: Params) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId } = await params
  const row = getThread(threadId, session.user.id)
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const parsed = patchBodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  if (parsed.data.title !== undefined) {
    renameThread(threadId, session.user.id, parsed.data.title)
  }
  if (parsed.data.status !== undefined) {
    setThreadStatus(threadId, session.user.id, parsed.data.status)
  }
  return Response.json(toThreadMetadata(getThread(threadId, session.user.id)!))
}

export const DELETE = async (_req: Request, { params }: Params) => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId } = await params
  const row = getThread(threadId, session.user.id)
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  deleteThread(threadId, session.user.id)
  return new Response(null, { status: 204 })
}
