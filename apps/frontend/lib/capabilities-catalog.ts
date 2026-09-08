// Stub capability catalog for the caller-simulation chat.
//
// A "capability" is the assignment's central artifact: a recorded UI-automation
// flow with typed inputs, typed outputs, a checkpoint, and a risk class, which a
// calling AI agent invokes by name. Until the automation engine (apps/engine)
// records and replays real capabilities, this module returns clearly-labeled
// stub data so the chat's tool surface, approval gate, and result rendering are
// fully exercisable. The shapes here are the contract the engine will honor.

export type CapabilityRisk = "safe" | "risky"

export type CapabilityInput = {
  name: string
  type: "string" | "number" | "enum"
  required: boolean
  description: string
  /** Allowed values when type is "enum". */
  values?: readonly string[]
}

export type CapabilityOutput = {
  name: string
  type: "string" | "number" | "boolean" | "date"
  description: string
}

export type Capability = {
  id: string
  version: string
  name: string
  description: string
  /** Proxy back-office application the flow was recorded against. */
  targetApp: string
  risk: CapabilityRisk
  inputs: readonly CapabilityInput[]
  outputs: readonly CapabilityOutput[]
  /** Success condition asserted at the end of replay. */
  checkpoint: string
  /** Number of recorded steps, for display. */
  stepCount: number
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "lookup_member_balance",
    version: "1.2.0",
    name: "Look up member balances",
    description:
      "Search for a member by ID and read their current savings and checking balances from the member detail page.",
    targetApp: "FinCore Teller (proxy)",
    risk: "safe",
    inputs: [
      {
        name: "memberId",
        type: "string",
        required: true,
        description: 'The member\'s numeric ID, e.g. "12345".',
      },
    ],
    outputs: [
      {
        name: "memberName",
        type: "string",
        description: "Full name as shown on the member detail page.",
      },
      {
        name: "savingsBalance",
        type: "number",
        description: "Current savings balance in USD.",
      },
      {
        name: "checkingBalance",
        type: "number",
        description: "Current checking balance in USD.",
      },
      {
        name: "asOf",
        type: "date",
        description: "When the balances were read.",
      },
    ],
    checkpoint:
      "Member detail page is visible and shows the requested member's name and account summary.",
    stepCount: 4,
  },
  {
    id: "open_sub_account",
    version: "1.0.3",
    name: "Open a sub-account",
    description:
      "Open a new sub-account for an existing member and stop at the confirmation screen with the new account ID.",
    targetApp: "FinCore Teller (proxy)",
    risk: "risky",
    inputs: [
      {
        name: "memberId",
        type: "string",
        required: true,
        description: "The member's numeric ID.",
      },
      {
        name: "accountType",
        type: "enum",
        required: true,
        description: "Type of sub-account to open.",
        values: ["savings", "checking", "money-market"],
      },
      {
        name: "initialDeposit",
        type: "number",
        required: true,
        description: "Opening deposit in USD (0 or more).",
      },
      {
        name: "nickname",
        type: "string",
        required: false,
        description: "Optional display nickname for the account.",
      },
    ],
    outputs: [
      {
        name: "accountId",
        type: "string",
        description: "ID of the newly created account.",
      },
      {
        name: "confirmationNumber",
        type: "string",
        description: "Confirmation number from the final screen.",
      },
    ],
    checkpoint:
      "Confirmation screen is visible and displays the new account ID and confirmation number.",
    stepCount: 7,
  },
  {
    id: "freeze_card",
    version: "0.9.1",
    name: "Freeze a debit card",
    description:
      "Freeze a member's debit card (lost, stolen, or suspected fraud) and verify the card status reads Frozen.",
    targetApp: "FinCore Teller (proxy)",
    risk: "risky",
    inputs: [
      {
        name: "memberId",
        type: "string",
        required: true,
        description: "The member's numeric ID.",
      },
      {
        name: "cardLast4",
        type: "string",
        required: true,
        description: "Last four digits of the card.",
      },
      {
        name: "reason",
        type: "enum",
        required: true,
        description: "Why the card is being frozen.",
        values: ["lost", "stolen", "fraud-suspected", "member-request"],
      },
    ],
    outputs: [
      {
        name: "cardStatus",
        type: "string",
        description: "Card status after the operation (expected: Frozen).",
      },
      {
        name: "frozenAt",
        type: "date",
        description: "When the freeze took effect.",
      },
    ],
    checkpoint: "Card detail page is visible and the card status reads Frozen.",
    stepCount: 5,
  },
] as const

export const getCapability = (id: string): Capability | undefined =>
  CAPABILITIES.find((capability) => capability.id === id)

export const getCapabilityRisk = (id: string): CapabilityRisk | undefined =>
  getCapability(id)?.risk

export type InvokeCapabilitySuccess = {
  status: "success"
  /** Always true while the engine is not connected — see module docstring. */
  stub: true
  capabilityId: string
  capabilityName: string
  version: string
  inputs: Record<string, unknown>
  outputs: Record<string, string | number | boolean>
  stepsExecuted: number
  durationMs: number
}

export type InvokeCapabilityBusinessOutcome = {
  status: "business_outcome"
  stub: true
  capabilityId: string
  capabilityName: string
  /** Machine-readable outcome code, e.g. "member_not_found". */
  outcome: string
  detail: string
  inputs: Record<string, unknown>
  stepsExecuted: number
  durationMs: number
}

export type InvokeCapabilityError = {
  status: "error"
  stub: true
  capabilityId: string
  message: string
}

export type InvokeCapabilityResult =
  | InvokeCapabilitySuccess
  | InvokeCapabilityBusinessOutcome
  | InvokeCapabilityError

// Deterministic pseudo-random source seeded from the inputs, so a stub
// invocation returns the same "data" for the same inputs — like a real replay.
const seededNumber = (seed: string, min: number, max: number): number => {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const ratio = (Math.abs(hash) % 10000) / 10000
  return Math.round((min + ratio * (max - min)) * 100) / 100
}

const STUB_MEMBER_NAMES = [
  "Jordan Avery",
  "Riley Chen",
  "Morgan Okafor",
  "Taylor Nguyen",
  "Casey Rivera",
] as const

// Simulates a deterministic replay of a saved capability against the proxy
// target. Mirrors the assignment's result taxonomy: success with outputs, a
// known business outcome (member not found), or a hard failure (unknown
// capability). A short delay makes running states observable in the UI.
export const invokeStubCapability = async (
  capabilityId: string,
  inputs: Record<string, unknown>
): Promise<InvokeCapabilityResult> => {
  const capability = getCapability(capabilityId)
  if (!capability) {
    return {
      status: "error",
      stub: true,
      capabilityId,
      message: `Unknown capability "${capabilityId}". Call list_capabilities to see what is available.`,
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1200))

  const memberId = String(inputs.memberId ?? "")
  const durationMs = Math.round(
    seededNumber(`${capabilityId}:${memberId}`, 1800, 4200)
  )

  // Demo hook for the business-outcome path: member IDs starting with "0"
  // do not exist in the proxy target.
  if ("memberId" in inputs && memberId.startsWith("0")) {
    return {
      status: "business_outcome",
      stub: true,
      capabilityId,
      capabilityName: capability.name,
      outcome: "member_not_found",
      detail: `No member exists with ID "${memberId}". This is a legitimate answer for the caller, not a system failure.`,
      inputs,
      stepsExecuted: 2,
      durationMs,
    }
  }

  switch (capabilityId) {
    case "lookup_member_balance":
      return {
        status: "success",
        stub: true,
        capabilityId,
        capabilityName: capability.name,
        version: capability.version,
        inputs,
        outputs: {
          memberName:
            STUB_MEMBER_NAMES[
              Math.abs(
                seededNumber(memberId, 0, STUB_MEMBER_NAMES.length - 1)
              ) % STUB_MEMBER_NAMES.length
            ]!,
          savingsBalance: seededNumber(`${memberId}:savings`, 400, 48000),
          checkingBalance: seededNumber(`${memberId}:checking`, 120, 9500),
          asOf: new Date().toISOString(),
        },
        stepsExecuted: capability.stepCount,
        durationMs,
      }
    case "open_sub_account":
      return {
        status: "success",
        stub: true,
        capabilityId,
        capabilityName: capability.name,
        version: capability.version,
        inputs,
        outputs: {
          accountId: `AC-${Math.round(seededNumber(`${memberId}:acct`, 100000, 999999))}`,
          confirmationNumber: `CNF-${Math.round(seededNumber(`${memberId}:conf`, 10000000, 99999999))}`,
        },
        stepsExecuted: capability.stepCount,
        durationMs,
      }
    case "freeze_card":
      return {
        status: "success",
        stub: true,
        capabilityId,
        capabilityName: capability.name,
        version: capability.version,
        inputs,
        outputs: {
          cardStatus: "Frozen",
          frozenAt: new Date().toISOString(),
        },
        stepsExecuted: capability.stepCount,
        durationMs,
      }
    default:
      return {
        status: "error",
        stub: true,
        capabilityId,
        message: `Capability "${capabilityId}" has no stub invocation handler yet.`,
      }
  }
}
