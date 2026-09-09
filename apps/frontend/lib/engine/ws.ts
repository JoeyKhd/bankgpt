/**
 * Live-session control channel (D-046 transport decision).
 *
 * Next.js route handlers CANNOT proxy WebSocket upgrades, so the browser
 * connects DIRECTLY to the engine's /ws channel (same origin policy does
 * not apply to WebSocket). The URL comes from NEXT_PUBLIC_ENGINE_WS_URL
 * (name-only in .env.example); it defaults to the engine's dev port.
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
 * in production ENGINE_WS_URL below is only a fallback: the real value is
 * read server-side at request time and handed down through
 * EngineWsUrlProvider (see ./ws-url-context, D-065).
 *
 * The channel is localhost trust-boundary (documented cut): it carries
 * control messages (pause / cede / resume) and step events, not auth. All
 * operator identity flows through the authenticated /api/engine HTTP proxy;
 * the WS only correlates by runId + a display name for the control log.
 */
export type EngineControlMessage = {
  type: string
  runId?: string
  applied?: boolean
  owner?: "automation" | "human"
  paused?: boolean
  interventionId?: string
  kind?: string
  status?: string
  stepIndex?: number
  action?: string
  intent?: string
  ok?: boolean
  detail?: string
  sessions?: Array<{ runId: string; owner: string; paused: boolean }>
}

export const ENGINE_WS_URL =
  process.env.NEXT_PUBLIC_ENGINE_WS_URL ?? "ws://127.0.0.1:4011/ws"

export type ControlCommand = {
  type: "pause" | "cede" | "resume" | "human-action"
  runId: string
  operator?: string
  detail?: string
}

/**
 * Open the control channel. Returns a handle; `send` is a no-op until the
 * socket opens (messages before open are dropped — control actions are
 * user-driven, never queued silently).
 */
export const connectEngineControl = (params: {
  onEvent: (message: EngineControlMessage) => void
  onStateChange?: (open: boolean) => void
  /** Runtime URL from useEngineWsUrl(); falls back to the build-time value. */
  url?: string
}): { send: (command: ControlCommand) => void; close: () => void } => {
  const socket = new WebSocket(params.url ?? ENGINE_WS_URL)
  socket.onmessage = (event) => {
    try {
      params.onEvent(JSON.parse(String(event.data)) as EngineControlMessage)
    } catch {
      // Malformed frames are ignored; the channel stays open.
    }
  }
  socket.onopen = () => params.onStateChange?.(true)
  socket.onclose = () => params.onStateChange?.(false)
  socket.onerror = () => params.onStateChange?.(false)
  return {
    send: (command) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(command))
      }
    },
    close: () => socket.close(),
  }
}
