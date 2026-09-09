import { approveEngineIntervention } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// POST /api/engine/approvals/[id]/approve — issues a one-time approval token.
export const POST = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => approveEngineIntervention((await ctx.params).id))
