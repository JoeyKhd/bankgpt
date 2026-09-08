"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

// "Mounted" is a client-only fact, so it must not differ between SSR and the
// first client render — that mismatch would poison hydration for the session.
// Both snapshots therefore report false; after hydration React re-subscribes
// and re-reads the client snapshot, flipping to true in a separate render.
export const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
