import { getEngineCapability } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/capabilities/[id] — one capability + its parsed artifact.
export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => getEngineCapability((await ctx.params).id))
