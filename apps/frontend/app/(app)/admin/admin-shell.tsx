"use client"

import { useQuery } from "@tanstack/react-query"
import {
  BotIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"
import { interventionsQuery, useEngineEventInvalidation } from "@/lib/engine"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operate",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboardIcon },
      { href: "/admin/discover", label: "Discovery", icon: SearchIcon },
      {
        href: "/admin/capabilities",
        label: "Capabilities",
        icon: FlaskConicalIcon,
      },
      { href: "/admin/runs", label: "Runs", icon: ClipboardListIcon },
      { href: "/admin/interventions", label: "Interventions", icon: BotIcon },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: UsersIcon,
        adminOnly: true,
      },
      {
        href: "/admin/policy",
        label: "Safety policy",
        icon: ShieldCheckIcon,
        adminOnly: true,
      },
      {
        href: "/admin/system",
        label: "System",
        icon: Settings2Icon,
        adminOnly: true,
      },
    ],
  },
]

// Live count of requests awaiting a human decision, shown on the
// Interventions nav item. The query is shared with the inbox page's cache;
// the refetch interval on interventionsQuery keeps it fresh from anywhere
// in the console, and the engine's WS broadcasts make it near-instant.
const PendingInterventionsBadge = () => {
  const interventions = useQuery(interventionsQuery())
  const pending =
    interventions.data?.filter((i) => i.status === "pending").length ?? 0
  if (pending === 0) return null
  return (
    <span
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-px text-xs font-medium text-amber-300"
      aria-label={`${pending} pending interventions`}
    >
      {pending}
    </span>
  )
}

const SignOutButton = () => {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut()
        router.replace("/login")
      }}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
    >
      <LogOutIcon className="size-4" />
      Sign out
    </button>
  )
}

export const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user.role === "admin"
  // Engine lifecycle broadcasts → instant query invalidation for the badge
  // and every console page, without waiting for the next poll.
  useEngineEventInvalidation()

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/6 bg-card/40">
        <div className="flex items-center gap-2.5 border-b border-white/6 px-4 py-4">
          <Image
            src="/bankgpt-mark.svg"
            alt="BankGPT"
            width={45}
            height={27}
            className="shrink-0"
          />
          <span className="text-sm leading-tight font-semibold">BankGPT</span>
        </div>

        <nav className="flex flex-1 flex-col gap-5 px-3 py-4">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter(
              (item) => !item.adminOnly || isAdmin
            )
            if (items.length === 0) return null
            return (
              <div key={section.label} className="flex flex-col gap-0.5">
                <span className="px-3 pb-1.5 font-mono text-xs font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  {section.label}
                </span>
                {items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-emerald-400/10 font-medium text-emerald-200"
                          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                      {item.href === "/admin/interventions" && (
                        <PendingInterventionsBadge />
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/6 px-3 py-3">
          <Link
            href="/chat"
            className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <WrenchIcon className="size-4" />
            Caller chat
          </Link>
          <SignOutButton />
          {session && (
            <div className="mt-2 flex items-center gap-2 px-3 pt-1">
              <span className="truncate text-[11px] text-muted-foreground/70">
                {session.user.email}
              </span>
              {isAdmin && (
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-px text-xs font-medium text-emerald-300">
                  admin
                </span>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6 sm:px-8">{children}</main>
    </div>
  )
}
