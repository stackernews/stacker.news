#!/usr/bin/env bash
set -euo pipefail

exec bash .platform/hooks/predeploy/00-migrate.sh
