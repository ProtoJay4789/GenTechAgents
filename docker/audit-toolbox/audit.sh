#!/bin/sh
set -e

if [ -z "$1" ]; then
  echo "Usage: audit.sh <github-repo-url>"
  exit 1
fi

REPO_URL="$1"
REPO_NAME=$(basename "$REPO_URL" .git)

echo "==> Cloning $REPO_URL into /audits/$REPO_NAME"
git clone "$REPO_URL" "/audits/$REPO_NAME"
cd "/audits/$REPO_NAME"

echo "==> Running forge build"
forge build

echo "==> Running forge test"
forge test

echo "==> Audit complete for $REPO_NAME"
