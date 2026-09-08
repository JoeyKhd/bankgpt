/**
 * Safety & policy guardrails (assignment §3.4).
 *
 * Two responsibilities:
 *
 * 1. ALLOWLIST + RISK ENFORCEMENT. A run may only navigate to URLs matching
 *    `allowedUrlPatterns` and may only execute actions in `allowedActions`.
 *    Risky actions ("risky" capability class, or an action not in the safe
 *    default set) require an explicit approval token before execution.
 *    The engine enforces this in both discovery and replay.
 *
 * 2. REDACTION. Secrets and PII-shaped values must never persist into
 *    artifacts, run logs, or evidence. `redactText` / `redactValue` scrub
 *    credential-shaped and PII-shaped substrings before anything is written.
 *
 * The approval-token seam is deliberately simple now (one shared local token);
 * per-operator identity lands with the operator console. The ENFORCEMENT
 * points are what matter: every risky execution path calls
 * `requireApproval` first.
 */
import { z } from "zod"
import { StepActionSchema, RiskClassSchema } from "./artifact.js"

export const PolicySchema = z.object({
  /** Regexes the current page URL must match (any one) before any action. */
  allowedUrlPatterns: z.array(z.string()).min(1),
  /** Action types the agent may execute. */
  allowedActions: z.array(StepActionSchema).min(1),
  /**
   * Actions treated as safe/reversible. Anything allowed but NOT in this set
   * is treated as risky and requires approval per occurrence.
   */
  safeActions: z.array(StepActionSchema),
  /** Capability risk classes that always require an approval token to replay. */
  riskyClassesRequireApproval: z.array(RiskClassSchema).default(["risky"]),
  /** Require human review (`reviewed: true`) before a risky capability replays. */
  requireReviewForRisky: z.boolean().default(true),
  /** Max discovery steps before the loop stops itself. */
  maxDiscoverySteps: z.number().int().positive().default(24),
  /** Discovery wall-clock timeout. */
  discoveryTimeoutMs: z.number().int().positive().default(180_000),
})
export type Policy = z.infer<typeof PolicySchema>

/** Policy for local development against the fixture / mock bank target. */
export const defaultPolicy = (): Policy =>
  PolicySchema.parse({
    allowedUrlPatterns: [
      "^https?://localhost(:\\d+)?(/|$)",
      "^https?://127\\.0\\.0\\.1(:\\d+)?(/|$)",
    ],
    allowedActions: [
      "navigate",
      "click",
      "type",
      "select",
      "press",
      "wait",
      "extract",
    ],
    safeActions: [
      "navigate",
      "click",
      "type",
      "select",
      "press",
      "wait",
      "extract",
    ],
    riskyClassesRequireApproval: ["risky"],
    requireReviewForRisky: true,
    maxDiscoverySteps: 24,
    discoveryTimeoutMs: 180_000,
  })

/** Thrown when the agent attempts to leave the allowlisted scope. */
export class PolicyViolationError extends Error {
  readonly kind: "url" | "action"
  constructor(kind: "url" | "action", detail: string) {
    super(`policy violation (${kind}): ${detail}`)
    this.name = "PolicyViolationError"
    this.kind = kind
  }
}

/** Thrown when a risky step/capability runs without an approval token. */
export class ApprovalRequiredError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(`approval required: ${reason}`)
    this.name = "ApprovalRequiredError"
    this.reason = reason
  }
}

const urlAllowed = (policy: Policy, url: string): boolean =>
  policy.allowedUrlPatterns.some((pattern) => new RegExp(pattern).test(url))

/**
 * Assert a URL is inside the allowlisted scope. Called before every
 * navigation AND before every action (the page may have moved).
 */
export const assertUrlAllowed = (policy: Policy, url: string): void => {
  if (!urlAllowed(policy, url)) {
    throw new PolicyViolationError("url", url)
  }
}

/** Assert an action type is permitted at all. */
export const assertActionAllowed = (policy: Policy, action: string): void => {
  if (!(policy.allowedActions as string[]).includes(action)) {
    throw new PolicyViolationError("action", action)
  }
}

const isSafeAction = (policy: Policy, action: string): boolean =>
  (policy.safeActions as string[]).includes(action)

/**
 * The enforcement seam for risky work. Callers must pass the approval token
 * issued by the approvals endpoint (or `undefined`); anything else throws.
 * `APPROVAL_TOKEN` is an opaque, per-approval one-time string — checking it
 * against the approvals store happens in the server layer, which calls this
 * only after the token is verified. Here we only enforce presence.
 */
export const requireApproval = (
  policy: Policy,
  params: { risk: "safe" | "risky"; action?: string; approved: boolean }
): void => {
  const actionIsRisky =
    params.action !== undefined && !isSafeAction(policy, params.action)
  if (params.risk === "risky" || actionIsRisky) {
    if (
      policy.riskyClassesRequireApproval.includes(params.risk) ||
      actionIsRisky
    ) {
      if (!params.approved) {
        throw new ApprovalRequiredError(
          actionIsRisky
            ? `action "${params.action}" is outside the safe action set`
            : `capability risk class "${params.risk}" requires approval`
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Patterns for secret/PII-shaped substrings. We redact aggressively: in this
 * system nothing legitimate needs to persist a token, card number, or SSN.
 */
const REDACTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  // OpenRouter / generic API keys (sk-..., or_..., long hex+bearer)
  {
    pattern: /\b(sk-or-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{16,})\b/g,
    label: "api-key",
  },
  { pattern: /\bBearer\s+[A-Za-z0-9._~-]{12,}\b/gi, label: "bearer-token" },
  // US Social Security numbers
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "ssn" },
  // Payment-card-shaped numbers (13-19 digits, allowing spaces/dashes)
  { pattern: /\b(?:\d[ -]?){13,19}\b/g, label: "card-number" },
  // password= / passwd: style key-values in text
  {
    pattern: /\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
    label: "credential-kv",
  },
]

const REDACTED = "[REDACTED]"

/** Scrub secret/PII-shaped substrings from a single string. */
export const redactText = (text: string): string => {
  let out = text
  for (const { pattern } of REDACTION_PATTERNS) {
    out = out.replace(pattern, (match) => {
      // Keep the key name for credential-kv so logs stay readable.
      const kv = match.match(/^([A-Za-z_-]+\s*[:=])\s*/)
      return kv ? `${kv[1]}${REDACTED}` : REDACTED
    })
  }
  return out
}

/**
 * Deep-scrub any JSON-serializable value. Strings are redacted; object keys
 * that LOOK secret (password, secret, token, apiKey, ssn, cardNumber) have
 * their entire value replaced regardless of content.
 */
export const redactValue = (value: unknown): unknown => {
  if (typeof value === "string") return redactText(value)
  if (Array.isArray(value)) return value.map(redactValue)
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|passwd|secret|token|api_?key|ssn|card_?number/i.test(key)) {
        out[key] = REDACTED
      } else {
        out[key] = redactValue(v)
      }
    }
    return out
  }
  return value
}
