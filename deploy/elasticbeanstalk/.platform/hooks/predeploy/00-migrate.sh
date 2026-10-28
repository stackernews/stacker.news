#!/usr/bin/env bash
set -euo pipefail

migration_log=$(mktemp)
trap 'rm -f "$migration_log"' EXIT

while true; do
  if docker compose run --rm --no-deps -T \
    --entrypoint node web \
    node_modules/prisma/build/index.js migrate deploy 2>&1 | tee "$migration_log"; then
    exit 0
  else
    statuses=("${PIPESTATUS[@]}")
  fi

  if (( statuses[1] != 0 )); then
    exit "${statuses[1]}"
  fi
  if (( statuses[0] != 1 )) ||
    ! grep -qx 'Error: P1002' "$migration_log" ||
    ! grep -qF 'Context: Timed out trying to acquire a postgres advisory lock' "$migration_log"; then
    exit "${statuses[0]}"
  fi

  # EB controls the deployment deadline; a long migration can still be healthy.
  echo "Another migration holds Prisma's advisory lock; retrying in 5 seconds."
  sleep 5
done
