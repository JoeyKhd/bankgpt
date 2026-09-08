"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

type UserRow = {
  id: string
  name: string
  email: string
  role?: string | null
  createdAt: string | Date
}

const RoleBadge = ({ role }: { role?: string | null }) =>
  role === "admin" ? (
    <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
      admin
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      operator
    </span>
  )

export const UsersTable = ({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: string
}) => {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setRole = async (userId: string, role: "admin" | "operator") => {
    setPendingId(userId)
    setError(null)
    const { error } = await authClient.admin.setRole({ userId, role })
    setPendingId(null)
    if (error) {
      setError(error.message ?? "Failed to update role")
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/8 bg-white/[0.02] px-4 py-2.5">
          <span className="font-mono text-xs font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            User
          </span>
          <span className="font-mono text-xs font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Role
          </span>
          <span className="w-32" />
        </div>
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          const isAdmin = user.role === "admin"
          return (
            <div
              key={user.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/6 px-4 py-3 last:border-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {user.name}
                  {isSelf && (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      (you)
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <RoleBadge role={user.role} />
              <div className="flex w-32 justify-end">
                {isSelf ? (
                  <span className="px-2 text-[11px] text-muted-foreground/60">
                    cannot change own role
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={pendingId === user.id}
                    onClick={() =>
                      void setRole(user.id, isAdmin ? "operator" : "admin")
                    }
                  >
                    {pendingId === user.id && (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    )}
                    {isAdmin ? "Make operator" : "Make admin"}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
