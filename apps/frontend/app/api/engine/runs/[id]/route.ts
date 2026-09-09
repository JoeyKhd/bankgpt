import { getEngineRun } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/runs/[id] — one run with its parsed structured result.
export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => getEngineRun((await ctx.params).id))
