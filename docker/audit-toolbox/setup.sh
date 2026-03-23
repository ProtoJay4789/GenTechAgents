#!/bin/bash
set -e

REPO_DIR="/home/user/GenTechAgents"
SOURCE_DIR="$REPO_DIR/docker/audit-toolbox"
TARGET_DIR="$HOME/.jinn/audits/docker"

# Pull latest changes
if [ -d "$REPO_DIR/.git" ]; then
  echo "==> Pulling latest changes in $REPO_DIR"
  git -C "$REPO_DIR" pull origin claude/foundry-docker-setup-zHSvp || true
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: $SOURCE_DIR not found."
  echo "Make sure GenTechAgents is cloned at $REPO_DIR"
  exit 1
fi

echo "==> Installing audit-toolbox to $TARGET_DIR"

mkdir -p "$TARGET_DIR"
cp "$SOURCE_DIR/Dockerfile" "$TARGET_DIR/"
cp "$SOURCE_DIR/docker-compose.yml" "$TARGET_DIR/"
cp "$SOURCE_DIR/audit.sh" "$TARGET_DIR/"
cp "$SOURCE_DIR/build.sh" "$TARGET_DIR/"
cp "$SOURCE_DIR/run-audit.sh" "$TARGET_DIR/"
cp "$SOURCE_DIR/setup.sh" "$TARGET_DIR/"
chmod +x "$TARGET_DIR"/*.sh

echo "==> Installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Build the image:  bash ~/.jinn/audits/docker/build.sh"
echo "  2. Run an audit:     bash ~/.jinn/audits/docker/run-audit.sh /path/to/repo"
