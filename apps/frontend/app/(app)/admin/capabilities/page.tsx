import type { Metadata } from "next"

import { CapabilitiesList } from "@/components/admin/capabilities-list"

export const metadata: Metadata = { title: "Capabilities" }

export default function CapabilitiesPage() {
  return <CapabilitiesList />
}
