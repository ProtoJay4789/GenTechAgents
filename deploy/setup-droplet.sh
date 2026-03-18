#!/usr/bin/env bash
# GenTech-Agency Droplet Setup Script
# Ubuntu 24.04 — runs as root or sudo user
# Usage: bash setup-droplet.sh
set -euo pipefail

APP_DIR="/opt/gentech-agents"
APP_USER="gentech"

echo "==> [1/7] Creating app user and directory"
id -u "$APP_USER" &>/dev/null || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [2/7] Installing Node.js 22 via NodeSource"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git

echo "==> [3/7] Installing pnpm"
npm install -g pnpm@latest

echo "==> [4/7] Installing PM2"
npm install -g pm2

echo "==> [5/7] Cloning / updating repo"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull origin claude/setup-agents-oQWIP
else
  git clone --branch claude/setup-agents-oQWIP \
    https://github.com/ProtoJay4789/GenTechAgents.git "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [6/7] Installing dependencies and building"
cd "$APP_DIR"
sudo -u "$APP_USER" pnpm install --frozen-lockfile
sudo -u "$APP_USER" pnpm build

echo "==> [7/7] Deploying config and setting up PM2"
# Copy production config
mkdir -p "$APP_DIR/logs"
cp "$APP_DIR/deploy/config.production.yaml" "$APP_DIR/.jinn/config.yaml" 2>/dev/null || true

echo ""
echo "=================================================="
echo "  NEXT STEPS (run manually as $APP_USER):"
echo "=================================================="
echo ""
echo "  1. Copy your .env to the server:"
echo "     scp .env root@159.203.125.252:$APP_DIR/.env"
echo ""
echo "  2. Run jinn setup (first time only):"
echo "     sudo -u $APP_USER $APP_DIR/node_modules/.bin/jinn setup"
echo "     - This creates ~/.jinn/ and installs agents/config"
echo ""
echo "  3. Start with PM2:"
echo "     pm2 start $APP_DIR/deploy/ecosystem.config.cjs"
echo "     pm2 save"
echo "     pm2 startup"
echo ""
echo "  4. Check status:"
echo "     pm2 status"
echo "     pm2 logs gentech-agents"
echo ""
