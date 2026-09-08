import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"
import { createAccessControl } from "better-auth/plugins/access"

const accessControl = createAccessControl(defaultStatements)

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac: accessControl,
      roles: {
        admin: accessControl.newRole(adminAc.statements),
        operator: accessControl.newRole({ user: [] }),
      },
    }),
  ],
})
