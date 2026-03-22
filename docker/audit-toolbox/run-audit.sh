#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: run-audit.sh <path-to-local-repo>"
  exit 1
fi

REPO_PATH="$(cd "$1" && pwd)"

echo "==> Running audit on $REPO_PATH"
docker run --rm \
  -v "$REPO_PATH:/audits" \
  -w /audits \
  audit-toolbox \
  -c "forge build && forge test"
