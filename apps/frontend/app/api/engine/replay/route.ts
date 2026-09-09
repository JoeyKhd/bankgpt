import { startEngineReplay } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"
import { replayRequestSchema } from "@/lib/engine/schemas"

// POST /api/engine/replay — start an async replay run; answers 202 with
// { runId } when the engine is up, 503 when it is offline.
export const POST = (req: Request) =>
  engineRoute(async () =>
    startEngineReplay(replayRequestSchema.parse(await req.json()))
  )
