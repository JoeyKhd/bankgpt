import { getEngineRunEvidence } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/runs/[id]/evidence — the per-step structured log.
export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => getEngineRunEvidence((await ctx.params).id))
