#!/usr/bin/env sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  uv run --no-sync alembic upgrade head
fi

exec "$@"
