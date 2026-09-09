import { listEngineRuns } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/runs — discovery and replay runs, newest first.
export const GET = () => engineRoute(() => listEngineRuns())
