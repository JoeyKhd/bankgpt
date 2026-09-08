import { AISDKToolkit, type FrontendTools } from "@assistant-ui/ai-sdk"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"
import { headers } from "next/headers"

import toolkit from "@/app/(app)/chat/toolkit"
import { auth } from "@/lib/auth"
import { getCapabilityRisk } from "@/lib/capabilities-catalog"
import {
  DEFAULT_CHAT_MODEL_ID,
  isChatModelId,
  isReasoningEffort,
} from "@/lib/chat-models"

export const maxDuration = 60

// The simulated calling agent's persona. It decides WHAT work needs doing and
// delegates HOW to saved capabilities — it never drives a target UI itself.
const CALLER_SYSTEM_PROMPT = `You are the BankGPT calling agent — a simulation of interface.ai's agent-facing product. You demonstrate how a bank's AI agent delegates back-office work to the computer-use automation system this console operates.

How you work:
1. When the user asks for back-office work (member lookups, account operations, card actions, ...), call list_capabilities if you do not yet know what capabilities exist.
2. Invoke the matching capability with invoke_capability and well-typed inputs. Ask the user for any missing required inputs first.
3. Report the structured result faithfully: success outputs, a known business outcome (a legitimate answer, not a crash), or a hard failure.

Rules:
- NEVER describe driving an application's UI yourself. All work in target systems goes through capabilities; the automation engine replays them deterministically with no model in the loop.
- If no capability fits the request, say so plainly and suggest that a human operator record one in the admin console's discovery flow.
- Risky capabilities pause for human approval before running. Tell the user you are waiting for the operator's decision; never pressure them.
- Quote returned values exactly. Mention that results come from a stub catalog until the automation engine is connected.
- Be concise. Lead with the outcome.`

const openrouter = createOpenRouter()

const aiToolkit = new AISDKToolkit({ toolkit })

type ChatRequestBody = {
  messages: UIMessage[]
  tools?: FrontendTools
  config?: { modelName?: string; reasoningEffort?: string }
}

export const POST = async (req: Request) => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 500 }
    )
  }

  let body: ChatRequestBody
  try {
    body = (await req.json()) as ChatRequestBody
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const modelId = isChatModelId(body.config?.modelName)
    ? body.config!.modelName!
    : DEFAULT_CHAT_MODEL_ID
  const effort = isReasoningEffort(body.config?.reasoningEffort)
    ? body.config!.reasoningEffort!
    : undefined

  let messages
  try {
    messages = await convertToModelMessages(body.messages)
  } catch {
    return Response.json({ error: "Malformed messages" }, { status: 400 })
  }

  const result = streamText({
    model: openrouter(
      modelId,
      effort ? { extraBody: { reasoning: { effort } } } : undefined
    ),
    system: CALLER_SYSTEM_PROMPT,
    messages,
    tools: await aiToolkit.tools({ frontend: body.tools }),
    stopWhen: stepCountIs(8),
    toolApproval: {
      // The safety policy from the assignment, applied at the caller seam:
      // risky/irreversible capabilities pause for a human decision; safe ones
      // run straight through. Unknown capabilities fail inside execute.
      invoke_capability: (input) => {
        const { capabilityId } = input as { capabilityId?: string }
        return capabilityId && getCapabilityRisk(capabilityId) === "risky"
          ? "user-approval"
          : "not-applicable"
      },
    },
  })

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    messageMetadata: ({ part }) => {
      if (part.type === "finish") return { usage: part.totalUsage }
      if (part.type === "finish-step") return { modelId: part.response.modelId }
      return undefined
    },
  })
}
