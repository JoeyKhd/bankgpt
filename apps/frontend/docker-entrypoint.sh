#!/bin/sh
# Frontend container entrypoint.
# The better-auth schema must exist before the standalone server serves
# auth routes. Seed the persistent volume from the build-time migrated
# database on first boot (when DATABASE_URL's file does not exist yet).
# The better-auth tables are created by the migration baked into /seed; the
# chat_thread/chat_message tables self-create on first use (CREATE TABLE IF
# NOT EXISTS). Existing volumes are left untouched.
set -e

DB_PATH="${DATABASE_URL:-/data/app.sqlite}"
if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] no database at $DB_PATH — seeding from /seed/app.sqlite"
  mkdir -p "$(dirname "$DB_PATH")"
  cp /seed/app.sqlite "$DB_PATH"
fi

exec "$@"
