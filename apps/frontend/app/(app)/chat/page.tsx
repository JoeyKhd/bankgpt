import type { Metadata } from "next"

import { ChatClient } from "./chat-client"

export const metadata: Metadata = {
  title: "Caller Chat",
  description:
    "Simulated calling agent: delegate back-office work to saved automation capabilities.",
}

export default function ChatPage() {
  return <ChatClient />
}
