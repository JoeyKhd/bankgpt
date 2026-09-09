export type Role = "admin" | "operator"

// Server-side role checks. `role` is set by the admin plugin's defaultRole
// (see lib/auth.ts); every signup is "admin" (D-055). Null-safe:
// rows created before roles existed are treated as operators.
export const isAdmin = (user: { role?: string | null }): boolean =>
  user.role === "admin"
