import { headers } from "next/headers"

import { auth } from "@/lib/auth"

// Session for API routes; callers return 401 when this is null.
export const requireSession = async () => {
  return auth.api.getSession({ headers: await headers() })
}
