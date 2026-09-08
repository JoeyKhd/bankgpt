import path from "node:path"
import { betterAuth } from "better-auth"
import Database from "better-sqlite3"

// SQLite lives under gitignored `data/`; the app owns this file (auth + app data).
const database = new Database(
  process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.sqlite")
)

export const auth = betterAuth({
  database,
  emailAndPassword: {
    enabled: true,
  },
})
