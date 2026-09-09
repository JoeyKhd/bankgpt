import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { EngineWsUrlProvider } from "@/lib/engine"

// Every route inside (app) requires a signed-in user. The login page lives
// outside this group.
export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    redirect("/login")
  }
  // NEXT_PUBLIC_* is baked into the client bundle at build time, so the
  // browser would keep the dev WS default in a production image (D-065).
  // Server components read env at request time — pass the real value down
  // so the live-session channel works without rebuilding per environment.
  return (
    <EngineWsUrlProvider url={process.env.NEXT_PUBLIC_ENGINE_WS_URL}>
      {children}
    </EngineWsUrlProvider>
  )
}
