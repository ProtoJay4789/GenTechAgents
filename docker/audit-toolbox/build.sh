#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building audit-toolbox Docker image..."
docker build -t audit-toolbox "$SCRIPT_DIR"
echo "==> Done. Image tagged as audit-toolbox:latest"
