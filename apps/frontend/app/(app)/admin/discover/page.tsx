import type { Metadata } from "next"

import { PageStub } from "@/components/admin/page-stub"

export const metadata: Metadata = { title: "Discovery" }

export default function DiscoveryPage() {
  return (
    <PageStub
      title="Discovery"
      description="Start a goal-driven discovery run against a target application and watch the observe → decide → act loop live."
      planned={[
        "New discovery: natural-language goal + target URL/entry point",
        "Live run view: step log, current state/screenshot, stopping condition",
        "Save a successful run as a reusable, parameterized capability",
        "Pause / escalate to a human operator mid-run",
      ]}
    />
  )
}
