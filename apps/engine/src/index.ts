// Entry point for the automation engine service.
// Starts the HTTP API + WebSocket control channel (see server.ts).
import { openEngineDb } from "@/db"
import { defaultPolicy } from "@/policy"
import { startEngineServer } from "@/server"

const main = () => {
  const port = Number(process.env.ENGINE_PORT ?? 4011)
  const dbPath = process.env.ENGINE_DB_PATH ?? "data/engine.sqlite"
  const db = openEngineDb(dbPath)
  // The default policy only allowlists localhost/127.0.0.1 — right for dev,
  // but inside the compose network the mock bank target is reached by its
  // service name (http://mockbank:4010), which the policy would refuse as a
  // scope violation. ENGINE_ALLOWED_URL_PATTERNS (comma-separated regexes)
  // replaces the allowlist for that deployment. Keep it narrow: this is the
  // guardrail that stops the agent roaming the open web.
  const extraPatterns = process.env.ENGINE_ALLOWED_URL_PATTERNS?.split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean)
  const policy = defaultPolicy()
  if (extraPatterns && extraPatterns.length > 0) {
    policy.allowedUrlPatterns = extraPatterns
  }
  startEngineServer({ port, db, policy })
}

main()
