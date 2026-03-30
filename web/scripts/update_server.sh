#!/usr/bin/env bash
set -euo pipefail

# RCT-AI server auto update script
# Usage:
#   sudo bash /opt/rct-ai/web/scripts/update_server.sh
#
# Optional env vars:
#   APP_ROOT=/opt/rct-ai
#   WEB_DIR=/opt/rct-ai/web
#   BRANCH=main
#   PM2_NAME=rct-ai-web
#   APP_PORT=3000

APP_ROOT="${APP_ROOT:-/opt/rct-ai}"
WEB_DIR="${WEB_DIR:-$APP_ROOT/web}"
BRANCH="${BRANCH:-main}"
PM2_NAME="${PM2_NAME:-rct-ai-web}"
APP_PORT="${APP_PORT:-3000}"

echo "==> [1/8] Check paths"
if [[ ! -d "$APP_ROOT/.git" ]]; then
  echo "Error: $APP_ROOT is not a git repository."
  exit 1
fi
if [[ ! -f "$WEB_DIR/package.json" ]]; then
  echo "Error: $WEB_DIR/package.json not found."
  exit 1
fi

echo "==> [2/8] Update source code ($BRANCH)"
git -C "$APP_ROOT" fetch origin
git -C "$APP_ROOT" checkout "$BRANCH"
git -C "$APP_ROOT" pull --ff-only origin "$BRANCH"

echo "==> [3/8] Install dependencies"
cd "$WEB_DIR"
npm ci

echo "==> [4/8] Build app"
npm run build

echo "==> [5/8] Restart PM2 process"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start "npm run start -- -p $APP_PORT" --name "$PM2_NAME" --cwd "$WEB_DIR"
fi

echo "==> [6/8] Save PM2 process list"
pm2 save

echo "==> [7/8] Local health check"
sleep 2
curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null

echo "==> [8/8] Done"
echo "Update succeeded. PM2: $PM2_NAME, Port: $APP_PORT"
pm2 status "$PM2_NAME"
