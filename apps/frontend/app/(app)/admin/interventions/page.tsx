import type { Metadata } from "next"

import { PageStub } from "@/components/admin/page-stub"

export const metadata: Metadata = { title: "Interventions" }

export default function InterventionsPage() {
  return (
    <PageStub
      title="Interventions"
      description="When automation is stuck or needs a human decision, it raises an intervention request here and hands over the live session."
      planned={[
        "Operator inbox: pending requests with goal/capability, step, state, reason",
        "Take over the same live session, perform manual steps, hand control back",
        "Human actions recorded into the run's evidence",
        "Explicit control ownership (automation vs. human)",
      ]}
    />
  )
}
