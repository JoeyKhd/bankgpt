"use client"

import { useMemo } from "react"
import {
  useAui,
  type GenericThreadHistoryAdapter,
  type MessageFormatAdapter,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
} from "@assistant-ui/react"
import { AssistantStream, DataStreamDecoder } from "assistant-stream"

// RemoteThreadListAdapter backed by our SQLite API routes (threads + message
// history). The adapter reference must stay stable, so it is created once at
// module scope; per-thread state is resolved lazily through the scoped aui
// client inside unstable_useAdapters.

type WireThreadMetadata = {
  remoteId: string
  status: "regular" | "archived"
  title?: string
  externalId?: string
  lastMessageAt?: number
}

const toMetadata = (wire: WireThreadMetadata) => ({
  status: wire.status,
  remoteId: wire.remoteId,
  ...(wire.title !== undefined ? { title: wire.title } : {}),
  ...(wire.externalId !== undefined ? { externalId: wire.externalId } : {}),
  ...(wire.lastMessageAt !== undefined
    ? { lastMessageAt: new Date(wire.lastMessageAt) }
    : {}),
})

const jsonHeaders = { "content-type": "application/json" }

const request = async (
  input: string,
  init?: RequestInit
): Promise<Response> => {
  const res = await fetch(input, init)
  if (!res.ok) {
    throw new Error(`Thread request failed: ${res.status} ${input}`)
  }
  return res
}

const useThreadAdapters = () => {
  const aui = useAui()

  return useMemo(() => {
    const history: ThreadHistoryAdapter = {
      // useChatRuntime always goes through withFormat (its useExternalHistory
      // requires it); the base assistant-ui-format face stays unimplemented.
      load: () => {
        throw new Error("thread history: use withFormat()")
      },
      append: () => {
        throw new Error("thread history: use withFormat()")
      },
      withFormat: <TMessage, TStorageFormat extends Record<string, unknown>>(
        formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>
      ): GenericThreadHistoryAdapter<TMessage> => {
        // Pinned at run start so post-settle writes land on the originating
        // thread even if the user switches away mid-run.
        let pinnedRemoteId: string | null = null

        const currentRemoteId = () =>
          pinnedRemoteId ?? aui.threadListItem.getState().remoteId

        const persist = async (item: {
          parentId: string | null
          message: TMessage
        }) => {
          const remoteId =
            currentRemoteId() ??
            (await aui.threadListItem.initialize()).remoteId
          await request(`/api/threads/${remoteId}/messages`, {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify({
              messageId: formatAdapter.getId(item.message),
              parentId: item.parentId,
              format: formatAdapter.format,
              content: JSON.stringify(formatAdapter.encode(item)),
            }),
          })
        }

        return {
          pin: () => {
            pinnedRemoteId = aui.threadListItem.getState().remoteId ?? null
          },
          load: async () => {
            const remoteId = aui.threadListItem.getState().remoteId
            if (!remoteId) return { headId: null, messages: [] }
            const res = await request(`/api/threads/${remoteId}/messages`)
            const data = (await res.json()) as {
              headId: string | null
              messages: {
                id: string
                parent_id: string | null
                format: string
                content: TStorageFormat
              }[]
            }
            return {
              headId: data.headId,
              messages: data.messages.map((row) =>
                formatAdapter.decode({
                  id: row.id,
                  parent_id: row.parent_id,
                  format: row.format,
                  content: row.content,
                })
              ),
            }
          },
          append: persist,
          // The server upserts on (thread_id, message_id), so the same write
          // path covers both append and in-place rewrite after tool approval.
          update: persist,
          delete: async (items) => {
            const remoteId = currentRemoteId()
            if (!remoteId) return
            await request(`/api/threads/${remoteId}/messages/delete`, {
              method: "POST",
              headers: jsonHeaders,
              body: JSON.stringify({
                ids: items.map((item) => formatAdapter.getId(item.message)),
              }),
            })
          },
        }
      },
    }

    return { history }
  }, [aui])
}

export const threadListAdapter: RemoteThreadListAdapter = {
  list: async (params) => {
    const url = params?.after
      ? `/api/threads?after=${encodeURIComponent(params.after)}`
      : "/api/threads"
    const res = await request(url)
    const data = (await res.json()) as {
      threads: WireThreadMetadata[]
      nextCursor?: string
    }
    return {
      threads: data.threads.map(toMetadata),
      ...(data.nextCursor !== undefined ? { nextCursor: data.nextCursor } : {}),
    }
  },
  initialize: async (localId) => {
    const res = await request("/api/threads", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ localId }),
    })
    const wire = (await res.json()) as WireThreadMetadata
    return {
      remoteId: wire.remoteId,
      ...(wire.externalId !== undefined ? { externalId: wire.externalId } : {}),
    }
  },
  fetch: async (remoteId) => {
    const res = await request(`/api/threads/${remoteId}`)
    return toMetadata((await res.json()) as WireThreadMetadata)
  },
  rename: async (remoteId, title) => {
    await request(`/api/threads/${remoteId}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ title }),
    })
  },
  archive: async (remoteId) => {
    await request(`/api/threads/${remoteId}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ status: "archived" }),
    })
  },
  unarchive: async (remoteId) => {
    await request(`/api/threads/${remoteId}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ status: "regular" }),
    })
  },
  delete: async (remoteId) => {
    await request(`/api/threads/${remoteId}`, { method: "DELETE" })
  },
  generateTitle: async (remoteId, messages) => {
    const filteredMessages = messages.map((message) => ({
      ...message,
      content: message.content.filter(
        (part) => part.type === "text" || part.type === "tool-call"
      ),
    }))
    const res = await request(`/api/threads/${remoteId}/title`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ messages: filteredMessages }),
    })
    return AssistantStream.fromResponse(res, new DataStreamDecoder())
  },
  unstable_useAdapters: useThreadAdapters,
}
