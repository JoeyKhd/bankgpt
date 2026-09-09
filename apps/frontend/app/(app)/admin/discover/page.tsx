import type { Metadata } from "next"

import { DiscoverForm } from "@/components/admin/discover-form"

export const metadata: Metadata = { title: "Discovery" }

export default function DiscoveryPage() {
  return <DiscoverForm />
}
