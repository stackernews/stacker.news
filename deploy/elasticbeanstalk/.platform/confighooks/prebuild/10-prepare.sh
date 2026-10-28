#!/bin/bash
set -euo pipefail
exec python3 .platform/hooks/prebuild/10-prepare.py
