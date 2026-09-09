import { rejectEngineIntervention } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"
import { decideInterventionBodySchema } from "@/lib/engine/schemas"

// POST /api/engine/approvals/[id]/reject — deny as the signed-in operator.
export const POST = async (
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) =>
  engineRoute(async (session) =>
    rejectEngineIntervention(
      (await ctx.params).id,
      session.user.email,
      decideInterventionBodySchema.parse(await req.json().catch(() => ({})))
    )
  )
