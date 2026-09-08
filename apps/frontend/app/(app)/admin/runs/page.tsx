import type { Metadata } from "next"

import { PageStub } from "@/components/admin/page-stub"

export const metadata: Metadata = { title: "Runs" }

export default function RunsPage() {
  return (
    <PageStub
      title="Runs"
      description="Structured evidence for every discovery and replay execution."
      planned={[
        "Filterable run history: discovery and replay, status, capability",
        "Run detail: structured step log with reasons",
        "Failure evidence: screenshot / snapshot / trace",
        "Linked intervention records",
      ]}
    />
  )
}
