import { postEngineSessionAction } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"
import { sessionActionBodySchema } from "@/lib/engine/schemas"

// POST /api/engine/sessions/[runId]/action — one manual operator step on
// the live session. Only works while a HUMAN owns the session (cede first);
// every action is recorded into the run's evidence by the engine.
export const POST = async (
  req: Request,
  ctx: { params: Promise<{ runId: string }> }
) =>
  engineRoute(async () =>
    postEngineSessionAction(
      (await ctx.params).runId,
      sessionActionBodySchema.parse(await req.json())
    )
  )
