import { getEngineHealth } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/status — engine liveness probe (health).
export const GET = () => engineRoute(() => getEngineHealth())
