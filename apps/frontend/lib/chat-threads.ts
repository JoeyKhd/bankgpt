import { db } from "@/lib/db"

// Chat thread persistence for the caller simulation. Thread metadata and
// message history are per user; message content is the opaque encoded storage
// format produced by the client's history adapter (assistant-ui
// `MessageFormatAdapter`), so the server never interprets it.

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_thread (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'regular' CHECK (status IN ('regular', 'archived')),
    external_id TEXT,
    created_at INTEGER NOT NULL,
    last_message_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS chat_thread_user_idx
    ON chat_thread (user_id, status, last_message_at DESC);

  CREATE TABLE IF NOT EXISTS chat_message (
    thread_id TEXT NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    parent_id TEXT,
    format TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (thread_id, message_id)
  );
`)

export type ThreadStatus = "regular" | "archived"

export type ChatThreadRow = {
  id: string
  user_id: string
  title: string | null
  status: ThreadStatus
  external_id: string | null
  created_at: number
  last_message_at: number | null
}

export type ChatMessageRow = {
  thread_id: string
  message_id: string
  parent_id: string | null
  format: string
  content: string
}

const PAGE_SIZE = 50

const listStmt = db.prepare<[string, number, number]>(`
  SELECT * FROM chat_thread
  WHERE user_id = ? AND status = 'regular'
  ORDER BY COALESCE(last_message_at, created_at) DESC, id DESC
  LIMIT ? OFFSET ?
`)

const getStmt = db.prepare<[string, string]>(
  "SELECT * FROM chat_thread WHERE id = ? AND user_id = ?"
)

const insertThreadStmt = db.prepare<[string, string, string | null, number]>(`
  INSERT INTO chat_thread (id, user_id, external_id, created_at)
  VALUES (?, ?, ?, ?)
`)

const renameStmt = db.prepare<[string, string, string]>(
  "UPDATE chat_thread SET title = ? WHERE id = ? AND user_id = ?"
)

const statusStmt = db.prepare<[string, string, string]>(
  "UPDATE chat_thread SET status = ? WHERE id = ? AND user_id = ?"
)

const deleteThreadStmt = db.prepare<[string, string]>(
  "DELETE FROM chat_thread WHERE id = ? AND user_id = ?"
)

const listMessagesStmt = db.prepare<[string]>(
  "SELECT * FROM chat_message WHERE thread_id = ? ORDER BY rowid ASC"
)

const headStmt = db.prepare<[string]>(
  "SELECT message_id FROM chat_message WHERE thread_id = ? ORDER BY rowid DESC LIMIT 1"
)

const upsertMessageStmt = db.prepare(`
  INSERT INTO chat_message (thread_id, message_id, parent_id, format, content)
  VALUES (@threadId, @messageId, @parentId, @format, @content)
  ON CONFLICT (thread_id, message_id)
  DO UPDATE SET parent_id = @parentId, format = @format, content = @content
`)

const touchStmt = db.prepare<[number, string]>(
  "UPDATE chat_thread SET last_message_at = ? WHERE id = ?"
)

const deleteMessagesStmt = db.prepare<[string, string]>(
  "DELETE FROM chat_message WHERE thread_id = ? AND message_id = ?"
)

export const listThreads = (
  userId: string,
  after?: string
): { threads: ChatThreadRow[]; nextCursor?: string } => {
  const offset = after ? Number.parseInt(after, 10) || 0 : 0
  const rows = listStmt.all(userId, PAGE_SIZE + 1, offset) as ChatThreadRow[]
  const threads = rows.slice(0, PAGE_SIZE)
  return {
    threads,
    ...(rows.length > PAGE_SIZE
      ? { nextCursor: String(offset + PAGE_SIZE) }
      : {}),
  }
}

export const getThread = (id: string, userId: string): ChatThreadRow | null =>
  (getStmt.get(id, userId) as ChatThreadRow | undefined) ?? null

export const createThread = (
  userId: string,
  externalId: string | null
): ChatThreadRow => {
  const id = crypto.randomUUID()
  insertThreadStmt.run(id, userId, externalId, Date.now())
  return getThread(id, userId)!
}

export const renameThread = (
  id: string,
  userId: string,
  title: string
): void => {
  renameStmt.run(title, id, userId)
}

export const setThreadStatus = (
  id: string,
  userId: string,
  status: ThreadStatus
): void => {
  statusStmt.run(status, id, userId)
}

export const deleteThread = (id: string, userId: string): void => {
  deleteThreadStmt.run(id, userId)
}

export const listMessages = (
  threadId: string
): { headId: string | null; messages: ChatMessageRow[] } => ({
  headId:
    (headStmt.get(threadId) as { message_id: string } | undefined)
      ?.message_id ?? null,
  messages: listMessagesStmt.all(threadId) as ChatMessageRow[],
})

// Insert or rewrite a stored message; bumps the thread's activity timestamp.
export const putMessage = (
  threadId: string,
  message: {
    messageId: string
    parentId: string | null
    format: string
    content: string
  }
): void => {
  upsertMessageStmt.run({
    threadId,
    messageId: message.messageId,
    parentId: message.parentId,
    format: message.format,
    content: message.content,
  })
  touchStmt.run(Date.now(), threadId)
}

export const deleteMessages = (threadId: string, ids: string[]): void => {
  for (const id of ids) deleteMessagesStmt.run(threadId, id)
}

// Wire shape consumed by the client's RemoteThreadListAdapter.
export const toThreadMetadata = (row: ChatThreadRow) => ({
  remoteId: row.id,
  status: row.status,
  ...(row.title !== null ? { title: row.title } : {}),
  ...(row.external_id !== null ? { externalId: row.external_id } : {}),
  ...(row.last_message_at !== null
    ? { lastMessageAt: row.last_message_at }
    : {}),
})
