import {
  listEngineInterventions,
  requestEngineApproval,
} from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"
import { requestApprovalBodySchema } from "@/lib/engine/schemas"

// GET /api/engine/approvals — the operator inbox (all interventions).
export const GET = () => engineRoute(async () => listEngineInterventions())

// POST /api/engine/approvals — request approval for a risky capability
// invocation (chat + console). requestedBy is the session email, attached
// server-side; the requester can never approve their own request silently —
// the decision lands in a DIFFERENT operator's inbox.
export const POST = (req: Request) =>
  engineRoute(async (session) =>
    requestEngineApproval({
      ...requestApprovalBodySchema.parse(await req.json()),
      requestedBy: session.user.email,
    })
  )
