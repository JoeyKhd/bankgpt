import { getEngineIntervention } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/approvals/[id] — one intervention (polled by the chat
// "waiting for operator" card and the interventions inbox).
export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => getEngineIntervention((await ctx.params).id))
