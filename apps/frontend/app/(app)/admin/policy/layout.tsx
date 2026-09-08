import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"

// Management surfaces are admin-only (D-022). Operators see the rest of the
// console but are redirected away from these routes.
export default async function AdminOnlyLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !isAdmin(session.user)) {
    redirect("/admin")
  }
  return children
}
