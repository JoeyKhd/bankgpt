import type { Metadata } from "next"

import { EngineProviders } from "@/components/admin/engine-providers"

import { AdminShell } from "./admin-shell"

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | BankGPT" },
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <EngineProviders>
      <AdminShell>{children}</AdminShell>
    </EngineProviders>
  )
}
