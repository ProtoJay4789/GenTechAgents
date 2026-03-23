#!/bin/bash
set -e

TARGET_DIR="$HOME/.jinn/audits/docker"

echo "==> Creating audit-toolbox at $TARGET_DIR"
mkdir -p "$TARGET_DIR"

# --- Dockerfile ---
cat > "$TARGET_DIR/Dockerfile" <<'DOCKERFILE'
FROM ghcr.io/foundry-rs/foundry:latest

# Install system dependencies (foundry image is Ubuntu 22.04-based)
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    git \
    wget \
    xdg-utils \
    libasound2 \
    libnss3 \
    libatk-bridge2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3.11 (browser-use requires >=3.11, Ubuntu 22.04 ships 3.10)
RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    && rm -rf /var/lib/apt/lists/*

# Create venv with Python 3.11 and install tools
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir \
    slither-analyzer \
    browser-use \
    playwright

# Install Chromium for browser-use
RUN playwright install --with-deps chromium

# Set working directory
WORKDIR /audits

# Copy audit script
COPY audit.sh /usr/local/bin/audit.sh
RUN chmod +x /usr/local/bin/audit.sh

ENTRYPOINT ["/bin/sh"]
DOCKERFILE

# --- docker-compose.yml ---
cat > "$TARGET_DIR/docker-compose.yml" <<'COMPOSE'
version: "3.8"

services:
  audit-toolbox:
    build: .
    image: audit-toolbox:latest
    volumes:
      - ./audits:/audits
    working_dir: /audits
    stdin_open: true
    tty: true
COMPOSE

# --- audit.sh ---
cat > "$TARGET_DIR/audit.sh" <<'AUDIT'
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
AUDIT

# --- build.sh ---
cat > "$TARGET_DIR/build.sh" <<'BUILD'
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building audit-toolbox Docker image..."
docker build -t audit-toolbox "$SCRIPT_DIR"
echo "==> Done. Image tagged as audit-toolbox:latest"
BUILD

# --- run-audit.sh ---
cat > "$TARGET_DIR/run-audit.sh" <<'RUNAUDIT'
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
RUNAUDIT

# Make scripts executable
chmod +x "$TARGET_DIR"/*.sh

echo ""
echo "==> Installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Build the image:  bash ~/.jinn/audits/docker/build.sh"
echo "  2. Run an audit:     bash ~/.jinn/audits/docker/run-audit.sh /path/to/repo"
