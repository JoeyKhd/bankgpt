import type { Metadata } from "next"

import { InterventionsInbox } from "@/components/admin/interventions-inbox"

export const metadata: Metadata = { title: "Interventions" }

export default function InterventionsPage() {
  return <InterventionsInbox />
}
