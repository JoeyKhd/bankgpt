"use client"

/**
 * Engine event invalidation over the WS control channel.
 *
 * The engine broadcasts intervention and run lifecycle events on the same
 * localhost control channel the take-over panel uses (lib/engine/ws.ts).
 * Listening here makes every engine-backed surface — the Interventions
 * inbox, the sidebar pending badge, and the caller chat's approval card —
 * react the moment an operator decides or a run settles, instead of waiting
 * for the next react-query poll. The polls stay as a backstop; this hook
 * only invalidates, it never writes cache data.
 */
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { engineKeys } from "./queries"
import { connectEngineControl, type EngineControlMessage } from "./ws"

export const useEngineEventInvalidation = () => {
  const queryClient = useQueryClient()
  useEffect(() => {
    const handle = connectEngineControl({
      onEvent: (message: EngineControlMessage) => {
        switch (message.type) {
          case "intervention-requested":
          case "intervention-resolved":
            // Prefix match covers both the list and intervention(id) keys.
            void queryClient.invalidateQueries({
              queryKey: engineKeys.interventions(),
            })
            break
          case "run-finished":
          case "session-closed":
            void queryClient.invalidateQueries({
              queryKey: engineKeys.runs(),
            })
            void queryClient.invalidateQueries({
              queryKey: engineKeys.interventions(),
            })
            break
        }
      },
    })
    return () => handle.close()
  }, [queryClient])
}
