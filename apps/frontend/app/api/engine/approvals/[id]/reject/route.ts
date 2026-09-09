import { rejectEngineIntervention } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// POST /api/engine/approvals/[id]/reject.
export const POST = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => rejectEngineIntervention((await ctx.params).id))
