import { startEngineDiscovery } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"
import { discoverRequestSchema } from "@/lib/engine/schemas"

// POST /api/engine/discover — start an async discovery run; answers 202
// with { runId } when the engine is up, 503 when it is offline.
export const POST = (req: Request) =>
  engineRoute(async () =>
    startEngineDiscovery(discoverRequestSchema.parse(await req.json()))
  )
