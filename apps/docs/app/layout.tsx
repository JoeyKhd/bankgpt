import type { Metadata } from "next"
import { IBM_Plex_Mono, Inter } from "next/font/google"
import type { ReactNode } from "react"
import { RootProvider } from "fumadocs-ui/provider/next"

import "./globals.css"

// BankGPT brand fonts (context/design/DESIGN.md): Inter for everything,
// IBM Plex Mono for eyebrows/labels.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "BankGPT Docs",
    template: "%s — BankGPT Docs",
  },
  description:
    "Documentation for the BankGPT computer-use automation system: LLM discovery, typed capability artifacts, and deterministic replay for back-office banking apps.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fontMono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        {/* Dark-only brand: force next-themes to dark, no toggle anywhere */}
        <RootProvider
          theme={{
            defaultTheme: "dark",
            forcedTheme: "dark",
            enableSystem: false,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
