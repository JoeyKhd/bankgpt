import type { Metadata } from "next"

import { PolicyView } from "@/components/admin/policy-view"

export const metadata: Metadata = { title: "Safety policy" }

export default function PolicyPage() {
  return <PolicyView />
}
