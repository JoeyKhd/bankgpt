export type Role = "admin" | "operator"

// Server-side role checks. `role` is set by the create hook / admin plugin
// (see lib/auth.ts); first registered user is "admin" (D-022). Null-safe:
// rows created before roles existed are treated as operators.
export const isAdmin = (user: { role?: string | null }): boolean =>
  user.role === "admin"
