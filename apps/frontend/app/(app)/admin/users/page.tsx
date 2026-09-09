import type { Metadata } from "next"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"

import { UsersTable } from "./users-table"

export const metadata: Metadata = { title: "Users" }

export default async function UsersPage() {
  const { users } = await auth.api.listUsers({
    query: { limit: 100, sortBy: "createdAt", sortDirection: "asc" },
    headers: await headers(),
  })
  const session = await auth.api.getSession({ headers: await headers() })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          User accounts. Every new signup is an admin; admins can demote others
          to operator (D-055).
        </p>
      </div>
      <UsersTable users={users} currentUserId={session!.user.id} />
    </div>
  )
}
