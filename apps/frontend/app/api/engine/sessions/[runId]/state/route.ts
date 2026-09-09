import { getEngineSessionState } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/sessions/[runId]/state — live session state for the
// take-over panel (ownership, url, aria snapshot, screenshot, control log).
// 404 while no live session exists for the run (finished runs close it).
export const GET = (_req: Request, ctx: { params: Promise<{ runId: string }> }) =>
  engineRoute(async () => getEngineSessionState((await ctx.params).runId))
