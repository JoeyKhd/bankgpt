import type { MetadataRoute } from "next"

// BankGPT brand colors from context/design/DESIGN.md
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BankGPT — Personal Financial Intelligence",
    short_name: "BankGPT",
    description:
      "An AI that sees all your money, understands what it means, and acts on your behalf to make you wealthier.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090B",
    theme_color: "#09090B",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  }
}
