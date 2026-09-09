import { approveEngineIntervention } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"
import { decideInterventionBodySchema } from "@/lib/engine/schemas"

// POST /api/engine/approvals/[id]/approve — decide as the SIGNED-IN
// operator (decidedBy is the session email, attached server-side). The
// engine issues a scoped one-time token and starts the run itself.
export const POST = async (
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) =>
  engineRoute(async (session) =>
    approveEngineIntervention(
      (await ctx.params).id,
      session.user.email,
      decideInterventionBodySchema.parse(await req.json().catch(() => ({})))
    )
  )
