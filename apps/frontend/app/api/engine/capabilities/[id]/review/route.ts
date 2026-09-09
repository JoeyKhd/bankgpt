import { markEngineCapabilityReviewed } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// POST /api/engine/capabilities/[id]/review — mark reviewed after human review.
export const POST = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => markEngineCapabilityReviewed((await ctx.params).id))
