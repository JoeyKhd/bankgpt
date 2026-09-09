import type { Metadata } from "next"

import { CapabilityDetail } from "@/components/admin/capability-detail"

export const metadata: Metadata = { title: "Capability detail" }

export default async function CapabilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CapabilityDetail id={id} />
}
