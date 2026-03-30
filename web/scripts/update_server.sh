#!/usr/bin/env bash
set -euo pipefail

# RCT-AI server auto update script (Next.js output: standalone)
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

if [[ ! -f "$WEB_DIR/.next/standalone/server.js" ]]; then
  echo "Error: standalone build missing at .next/standalone/server.js"
  exit 1
fi

echo "==> [5/8] Restart PM2 (standalone, not next start)"
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true

cd "$WEB_DIR"
# Load .env.local into environment for Node (ADMIN_*, NEXT_PUBLIC_*, etc.)
if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local" || true
  set +a
fi

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="$APP_PORT"

pm2 start "node .next/standalone/server.js" --name "$PM2_NAME" --cwd "$WEB_DIR"

echo "==> [6/8] Save PM2 process list"
pm2 save

echo "==> [7/8] Local health check"
sleep 2
if ! curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null; then
  echo "Health check failed. Recent logs:"
  pm2 logs "$PM2_NAME" --lines 40 --nostream || true
  exit 1
fi

echo "==> [8/8] Done"
echo "Update succeeded. PM2: $PM2_NAME, Port: $APP_PORT (standalone)"
pm2 status "$PM2_NAME"
