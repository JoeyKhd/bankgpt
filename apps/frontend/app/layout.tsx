import type { Metadata } from "next"
import { IBM_Plex_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

// BankGPT brand fonts (context/design/DESIGN.md): Inter for everything,
// IBM Plex Mono for eyebrows/labels.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bankgpt.ai"

const siteDescription =
  "An AI that sees all your money, understands what it means, and acts on your behalf to make you wealthier."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BankGPT — Personal Financial Intelligence",
    template: "%s | BankGPT",
  },
  description: siteDescription,
  keywords: [
    "BankGPT",
    "personal financial intelligence",
    "AI wealth advisor",
    "AI financial advisor",
    "personal finance AI",
    "agentic AI banking",
    "AI money management",
  ],
  applicationName: "BankGPT",
  authors: [{ name: "BankGPT", url: siteUrl }],
  creator: "BankGPT",
  publisher: "BankGPT",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "BankGPT",
    title: "BankGPT — Personal Financial Intelligence",
    description: siteDescription,
    // opengraph-image.png in app/ supplies the image tags automatically
  },
  twitter: {
    card: "summary_large_image",
    title: "BankGPT — Personal Financial Intelligence",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        {/* BankGPT organization + product structured data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl}/#organization`,
                  name: "BankGPT",
                  url: siteUrl,
                  logo: {
                    "@type": "ImageObject",
                    url: `${siteUrl}/bankgpt-logo.svg`,
                  },
                  description: siteDescription,
                },
                {
                  "@type": "WebSite",
                  "@id": `${siteUrl}/#website`,
                  url: siteUrl,
                  name: "BankGPT",
                  publisher: { "@id": `${siteUrl}/#organization` },
                },
                {
                  "@type": "SoftwareApplication",
                  name: "BankGPT",
                  applicationCategory: "FinanceApplication",
                  operatingSystem: "Web",
                  url: siteUrl,
                  description: siteDescription,
                  publisher: { "@id": `${siteUrl}/#organization` },
                },
              ],
            }),
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
