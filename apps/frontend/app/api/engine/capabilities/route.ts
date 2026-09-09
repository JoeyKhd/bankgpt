import { listEngineCapabilities } from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"

// GET /api/engine/capabilities — saved capability rows, newest first.
export const GET = () => engineRoute(() => listEngineCapabilities())
