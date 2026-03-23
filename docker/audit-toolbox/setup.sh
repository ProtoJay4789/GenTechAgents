#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$HOME/.jinn/audits/docker"

echo "==> Installing audit-toolbox to $TARGET_DIR"

mkdir -p "$TARGET_DIR"
cp "$SCRIPT_DIR/Dockerfile" "$TARGET_DIR/"
cp "$SCRIPT_DIR/docker-compose.yml" "$TARGET_DIR/"
cp "$SCRIPT_DIR/audit.sh" "$TARGET_DIR/"
cp "$SCRIPT_DIR/build.sh" "$TARGET_DIR/"
cp "$SCRIPT_DIR/run-audit.sh" "$TARGET_DIR/"
chmod +x "$TARGET_DIR"/*.sh

echo "==> Installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Build the image:  bash ~/.jinn/audits/docker/build.sh"
echo "  2. Run an audit:     bash ~/.jinn/audits/docker/run-audit.sh /path/to/repo"
