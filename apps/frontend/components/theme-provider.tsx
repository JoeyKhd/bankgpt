"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// The app is dark-only (D-033): no system preference, no light mode, no
// toggle. `forcedTheme` wins over any stored preference, so a stale
// localStorage theme can never light-render.
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
