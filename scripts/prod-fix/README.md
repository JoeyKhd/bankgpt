# Production capability fix (one-time)

Repairs the `get_member_balances` checkpoint (it asserted text mockbank never
renders as one string) and marks both capabilities reviewed. Run from the
repository root on the Dokploy host (the directory with docker-compose.yaml):

```bash
# copy the helper + SQL into the running engine container
docker compose cp scripts/prod-fix/apply-cap-fix.js engine:/tmp/apply-cap-fix.js
docker compose cp scripts/prod-fix/fix-balances.sql engine:/tmp/fix-balances.sql
docker compose cp scripts/prod-fix/review-subaccount.sql engine:/tmp/review-subaccount.sql

# apply (uses the container's own better-sqlite3)
docker compose exec engine node /tmp/apply-cap-fix.js /tmp/fix-balances.sql
docker compose exec engine node /tmp/apply-cap-fix.js /tmp/review-subaccount.sql
```

Each run prints the resulting capability rows — expect both
`get_member_balances` and `open_savings_sub_account` at `version: 1.0.1`,
`reviewed: 1`.
