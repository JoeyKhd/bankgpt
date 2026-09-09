"use client"

/**
 * Runtime engine WS URL (D-065).
 *
 * NEXT_PUBLIC_* env vars are inlined into the browser bundle at build time,
 * so a Docker image built once would bake in whatever
 * NEXT_PUBLIC_ENGINE_WS_URL was during \`next build\` — the dev fallback in
 * practice. To keep the image portable, the (app) layout reads the variable
 * server-side at request time (server components always evaluate env at
 * runtime) and passes it down through this provider. Consumers use
 * useEngineWsUrl(); outside the provider the build-time value is the
 * fallback, which keeps local dev working with zero setup.
 */
import { createContext, useContext } from "react"

import { ENGINE_WS_URL } from "./ws"

const EngineWsUrlContext = createContext<string | undefined>(undefined)

export const EngineWsUrlProvider = ({
  url,
  children,
}: {
  url?: string
  children: React.ReactNode
}) => (
  <EngineWsUrlContext.Provider value={url}>
    {children}
  </EngineWsUrlContext.Provider>
)

/** The engine control-channel URL: runtime value when provided, else the
 * build-time default (dev: ws://127.0.0.1:4011/ws). */
export const useEngineWsUrl = (): string =>
  useContext(EngineWsUrlContext) ?? ENGINE_WS_URL
