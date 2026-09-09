// Entry point for the automation engine service.
// Starts the HTTP API + WebSocket control channel (see server.ts).
import { openEngineDb } from "@/db"
import { startEngineServer } from "@/server"

const main = () => {
  const port = Number(process.env.ENGINE_PORT ?? 4011)
  const dbPath = process.env.ENGINE_DB_PATH ?? "data/engine.sqlite"
  const db = openEngineDb(dbPath)
  startEngineServer({ port, db })
}

main()
