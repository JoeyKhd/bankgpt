// Server-side redaction for persisted chat content (D-046 privacy posture:
// the SQLite store must never hold raw credentials or banking PII, even when
// a user pastes them into the caller chat).
//
// The chat_message.content column stores the JSON-encoded output of the
// client's history MessageFormatAdapter (format "ai-sdk/v6": a UIMessage
// shaped `{ role, parts, metadata? }` object). Redaction is FORMAT-AWARE: it
// parses that JSON and walks the decoded structure recursively — redacting
// values under credential-shaped KEYS anywhere in the tree and rewriting
// secret/PII-shaped STRINGS in place — instead of regex-ing opaque text.
// When the payload is not JSON (defensive; the column is always JSON today)
// it falls back to string-level redaction.

export const REDACTED = "[redacted]"

// Whole-value redaction when a KEY matches: split camelCase / snake_case /
// kebab-case keys into words and match exact sensitive words, so lookalikes
// survive — "totalTokens" (word "tokens") is token-usage metadata, not a
// credential, and stays readable.
const SENSITIVE_WORDS = new Set([
  "password",
  "passwd",
  "passphrase",
  "pwd",
  "secret",
  "token",
  "authorization",
  "credential",
  "credentials",
  "ssn",
  "pin",
  "cvv",
  "cvc",
  "cookie",
  "bearer",
])

// Normalized (separator-free, lowercased) full keys that are sensitive even
// though their individual words are generic, e.g. "apiKey" → "apikey".
const SENSITIVE_KEYS = new Set([
  "apikey",
  "apisecret",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "clientsecret",
  "privatekey",
  "accesskey",
  "secretkey",
  "sessionid",
  "sessiontoken",
  "cardnumber",
  "socialsecuritynumber",
])

const splitKeyWords = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s\-_./]+/)
    .map((word) => word.toLowerCase())
    .filter(Boolean)

export const isSensitiveKey = (key: string): boolean => {
  const words = splitKeyWords(key)
  if (words.some((word) => SENSITIVE_WORDS.has(word))) return true
  return SENSITIVE_KEYS.has(words.join(""))
}

// Secret/PII-shaped strings, rewritten in place wherever they appear.
const VALUE_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // "password=hunter2", `api_key: "…"` — inline key/value credentials.
  {
    pattern:
      /\b(password|passwd|passphrase|secret|api[-_ ]?key|auth[-_ ]?token|access[-_ ]?token|client[-_ ]?secret|ssn|cvv|pin)\s*[:=]\s*["']?[^\s,"'}{\]]{3,}/gi,
    replacement: "$1=$REDACTED",
  },
  // Bearer tokens in header-shaped text.
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g,
    replacement: "Bearer $REDACTED",
  },
  // JWTs (header always base64url-decodes to a JSON object → "eyJ").
  {
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g,
    replacement: "$REDACTED",
  },
  // Common API-key shapes: sk-…, sk-or-v1-…, pk-…
  {
    pattern: /\b(?:sk|pk)-(?:or-)?(?:v\d+-)?[A-Za-z0-9_-]{16,}\b/g,
    replacement: "$REDACTED",
  },
  // US Social Security numbers.
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "$REDACTED",
  },
  // Payment-card numbers: 13–19 digits, optionally grouped by spaces/dashes.
  {
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: "$REDACTED",
  },
]

// Rewrite secret/PII-shaped substrings in free text. Key-shaped secrets
// under known keys are handled by redactValue; this catches the same shapes
// embedded in prose ("my card is 4111 1111 1111 1111").
export const redactString = (value: string): string => {
  let out = value
  for (const { pattern, replacement } of VALUE_PATTERNS) {
    out = out.replace(pattern, replacement.replace("$REDACTED", REDACTED))
  }
  return out
}

// Recursively redact a decoded JSON tree: whole values under sensitive keys
// become REDACTED; strings anywhere are shape-redacted; numbers/booleans/
// null pass through untouched.
export const redactValue = (value: unknown): unknown => {
  if (typeof value === "string") return redactString(value)
  if (Array.isArray(value)) return value.map(redactValue)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? REDACTED : redactValue(entry),
      ])
    )
  }
  return value
}

// Redact one stored chat_message.content payload. The content is the
// adapter-encoded message as a JSON STRING (the client sends it pre-stringified),
// so parse → redact → re-encode; a non-JSON payload degrades to string-level
// redaction rather than failing the save.
export const redactEncodedMessageContent = (content: string): string => {
  try {
    return JSON.stringify(redactValue(JSON.parse(content) as unknown))
  } catch {
    return redactString(content)
  }
}
