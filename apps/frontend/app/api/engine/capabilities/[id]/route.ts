import {
  getEngineCapability,
  updateEngineCapability,
} from "@/lib/engine/client"
import { engineRoute } from "@/lib/engine/proxy"
import { capabilityArtifactSchema } from "@/lib/engine/schemas"

// GET /api/engine/capabilities/[id] — one capability + its parsed artifact.
export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => getEngineCapability((await ctx.params).id))

// PUT /api/engine/capabilities/[id] — update the artifact (console review
// edits, e.g. fixing a checkpoint). The body must be a valid artifact whose
// id matches the path; the engine upserts it and preserves review state.
export const PUT = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  engineRoute(async () => {
    const id = (await ctx.params).id
    const artifact = capabilityArtifactSchema.parse(await req.json())
    return updateEngineCapability(id, { ...artifact, id })
  })
