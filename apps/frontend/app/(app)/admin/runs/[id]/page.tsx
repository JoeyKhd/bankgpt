import type { Metadata } from "next"

import { RunDetail } from "@/components/admin/run-detail"

export const metadata: Metadata = { title: "Run detail" }

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <RunDetail runId={id} />
}
