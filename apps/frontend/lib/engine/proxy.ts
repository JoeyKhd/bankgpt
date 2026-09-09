/**
 * Thin wrapper shared by the /api/engine route handlers.
 *
 * Each handler is one line of engine client call wrapped here; this module
 * owns the cross-cutting concerns:
 * - auth: every engine route requires a signed-in user (same pattern as
 *   app/api/chat/route.ts), 401 otherwise;
 * - error mapping: engine offline → clean 503 with a helpful hint so the
 *   console degrades gracefully (the owner runs the engine separately);
 *   engine 4xx/5xx → forwarded status + message; contract drift → 502;
 *   malformed request bodies → 400.
 *
 * The engine never sees the user's session and the session cookie never
 * leaves Next — the proxy is the trust boundary (D-041).
 */
import { z } from "zod"

import { requireSession } from "@/lib/require-session"

import { getEngineUrl } from "./client"
import {
  EngineHttpError,
  EngineOfflineError,
  EngineValidationError,
} from "./errors"

/** The better-auth session of the signed-in user. Handlers receive it so
 * identity (requestedBy / decidedBy) is attached server-side, never trusted
 * from the client body. */
export type EngineSession = NonNullable<
  Awaited<ReturnType<typeof requireSession>>
>

export const engineRoute = async (
  handler: (session: EngineSession) => Promise<unknown>
): Promise<Response> => {
  const session = await requireSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return Response.json(await handler(session))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: err.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      )
    }
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (err instanceof EngineOfflineError) {
      return Response.json(
        {
          error: err.message,
          hint: `Start the engine with \`pnpm --filter engine dev\` (expected at ${getEngineUrl()}), then retry.`,
        },
        { status: 503 }
      )
    }
    if (err instanceof EngineHttpError) {
      return Response.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof EngineValidationError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    return Response.json(
      { error: "Unexpected error while proxying the engine" },
      { status: 500 }
    )
  }
}
