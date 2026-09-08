import path from "node:path"
import { betterAuth } from "better-auth"
import { admin as adminPlugin } from "better-auth/plugins/admin"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"
import { createAccessControl } from "better-auth/plugins/access"
import Database from "better-sqlite3"

// SQLite lives under gitignored `data/`; the app owns this file (auth + app data).
const database = new Database(
  process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.sqlite")
)

// Our two roles are named "admin" and "operator" (D-022), so the admin
// plugin uses a custom access controller instead of its default "user" role.
const accessControl = createAccessControl(defaultStatements)

export const auth = betterAuth({
  database,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    adminPlugin({
      ac: accessControl,
      roles: {
        admin: accessControl.newRole(adminAc.statements),
        operator: accessControl.newRole({ user: [] }),
      },
      defaultRole: "operator",
      adminRoles: ["admin"],
    }),
  ],
  user: {
    additionalFields: {
      // "admin" | "operator" — see context/thought-process.md D-022.
      role: {
        type: "string",
        // Nullable so existing rows migrate cleanly; the create hook and the
        // admin plugin always set it for new users (D-022).
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // First registered user is always the admin (D-022): whoever deploys
        // and signs up first owns the instance. Everyone after is an operator.
        before: async (user, ctx) => {
          const existing = ctx
            ? await ctx.context.adapter.count({ model: "user" })
            : 0
          return {
            data: { ...user, role: existing === 0 ? "admin" : "operator" },
          }
        },
      },
    },
  },
})
