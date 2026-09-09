import Image from "next/image"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

// Shared layout options for the home + docs layouts: BankGPT-branded nav
// title and no theme switch (the app is dark-only, forced in app/layout.tsx).
export const baseOptions = (): BaseLayoutProps => ({
  nav: {
    title: (
      <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
        <Image src="/bankgpt-mark.svg" alt="" width={28} height={17} priority />
        BankGPT
        <span className="rounded-full border border-fd-border px-2 py-0.5 font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
          Docs
        </span>
      </span>
    ),
  },
  themeSwitch: {
    enabled: false,
  },
})
