import { getEnginePolicy } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/policy — the engine's effective safety policy (read-only).
export const GET = () => engineRoute(() => getEnginePolicy())
