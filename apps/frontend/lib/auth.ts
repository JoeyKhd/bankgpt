import { betterAuth } from "better-auth"
import { admin as adminPlugin } from "better-auth/plugins/admin"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"
import { createAccessControl } from "better-auth/plugins/access"

import { db } from "@/lib/db"

const database = db

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
      // Every signup is an admin (D-055 supersedes the first-user rule from
      // D-022); "operator" stays defined so admins can demote an account.
      defaultRole: "admin",
      adminRoles: ["admin"],
    }),
  ],
  user: {
    additionalFields: {
      // "admin" | "operator" — see context/thought-process.md D-022 / D-055.
      role: {
        type: "string",
        // Nullable so existing rows migrate cleanly; the admin plugin sets
        // defaultRole for every new user (D-055).
        required: false,
        input: false,
      },
    },
  },
})
