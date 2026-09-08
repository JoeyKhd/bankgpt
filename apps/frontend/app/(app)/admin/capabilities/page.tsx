import type { Metadata } from "next"

import { PageStub } from "@/components/admin/page-stub"

export const metadata: Metadata = { title: "Capabilities" }

export default function CapabilitiesPage() {
  return (
    <PageStub
      title="Capabilities"
      description="The saved, reviewable automation artifacts an AI agent invokes. Until the engine records real ones, the caller chat demos against a stub catalog."
      planned={[
        "List: name, target app, version, last-run status and success rate",
        "Detail: ordered steps, element targeting + robustness, typed inputs/outputs, checkpoint",
        "Replay with typed input parameters and structured results",
        "Version history and linked runs",
      ]}
    />
  )
}
