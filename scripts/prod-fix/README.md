# Production capability fix (one-time)

Repairs the `get_member_balances` checkpoint (it asserted the single string
`Member ID 100231`, which mockbank never renders as one string — it is split
across `<th>Member ID</th><td>100231</td>`). Both capabilities are already
marked `reviewed` via the console.

Run this **one command** from the repository root on the Dokploy host (the
directory with `docker-compose.yaml`):

```bash
git pull && docker compose cp scripts/prod-fix/fix-balances.js engine:/tmp/fix.js && docker compose exec engine node /tmp/fix.js
```

It uses the engine container's own `better-sqlite3` to write a corrected,
reviewed `get_member_balances` v1.0.1, and prints the resulting row — expect
`version: 1.0.1`, `reviewed: 1`.

Then re-test: `POST /replay` with `{"capabilityId":"get_member_balances",
"inputs":{"memberId":"100231","username":"teller1","password":"demo"}}` should
reach `success`.

(The older `.sql` / `apply-cap-fix.js` files are superseded by `fix-balances.js`.)
