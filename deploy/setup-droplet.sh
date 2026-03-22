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
# Copy production config and ensure logs dir is owned by app user
mkdir -p "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/logs"
cp "$APP_DIR/deploy/config.production.yaml" "$APP_DIR/.jinn/config.yaml" 2>/dev/null || true

echo ""
echo "=================================================="
echo "  NEXT STEPS (run manually):"
echo "=================================================="
echo ""
echo "  1. Copy your .env to the server:"
echo "     scp .env root@159.203.125.252:$APP_DIR/.env"
echo ""
echo "  2. Fix logs directory ownership:"
echo "     chown -R $APP_USER:$APP_USER $APP_DIR/logs"
echo ""
echo "  3. Run jinn setup as $APP_USER (first time only):"
echo "     su - $APP_USER -c '$APP_DIR/node_modules/.bin/jinn setup'"
echo "     - This creates ~/.jinn/ and installs agents/config"
echo ""
echo "  4. Start PM2 as $APP_USER (NOT as root):"
echo "     su - $APP_USER -c 'pm2 start $APP_DIR/deploy/ecosystem.config.cjs'"
echo "     su - $APP_USER -c 'pm2 save'"
echo "     sudo env PATH=\$PATH pm2 startup systemd -u $APP_USER --hp /home/$APP_USER"
echo ""
echo "  NOTE: Claude Code refuses --dangerously-skip-permissions when run"
echo "  as root. Use 'su - $APP_USER' (not sudo -u) for a full login shell."
echo ""
echo "  5. Check status:"
echo "     su - $APP_USER -c 'pm2 status'"
echo "     su - $APP_USER -c 'pm2 logs gentech-agents'"
echo ""
