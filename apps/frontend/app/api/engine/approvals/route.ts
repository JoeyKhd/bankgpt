import { listEngineInterventions } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/approvals — interventions/approvals, newest first.
export const GET = () => engineRoute(() => listEngineInterventions())
