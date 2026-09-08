import path from "node:path"
import Database from "better-sqlite3"

// SQLite lives under gitignored `data/`; the app owns this file (auth + app data).
export const db = new Database(
  process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.sqlite")
)

// WAL lets readers proceed while another connection writes (the auth tables
// and the chat store share this file); busy_timeout absorbs brief contention
// instead of throwing "database is locked".
db.pragma("journal_mode = WAL")
db.pragma("busy_timeout = 5000")
