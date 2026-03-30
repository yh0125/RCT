#!/usr/bin/env bash
set -euo pipefail

# RCT-AI server auto update script (Next.js output: standalone)
# Usage (任选其一，注意当前目录):
#   在仓库根目录 rct-ai/     : sudo bash web/scripts/update_server.sh
#   已在 web/ 子目录里        : sudo bash scripts/update_server.sh
#   绝对路径示例              : sudo bash /opt/rct-ai/web/scripts/update_server.sh
#
# Optional env vars（一般不用设；脚本会按自己所在位置自动找 web/ 和仓库根）:
#   APP_ROOT=/path/to/rct-ai
#   WEB_DIR=/path/to/rct-ai/web
#   BRANCH=main
#   PM2_NAME=rct-ai-web
#   APP_PORT=3000

_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_DETECTED_WEB="$(cd "$_SCRIPT_DIR/.." && pwd)"
_DETECTED_ROOT="$(cd "$_DETECTED_WEB/.." && pwd)"

if [[ -n "${APP_ROOT:-}" && -n "${WEB_DIR:-}" ]]; then
  :
elif [[ -n "${APP_ROOT:-}" ]]; then
  WEB_DIR="$APP_ROOT/web"
elif [[ -n "${WEB_DIR:-}" ]]; then
  APP_ROOT="$(cd "$WEB_DIR/.." && pwd)"
else
  APP_ROOT="$_DETECTED_ROOT"
  WEB_DIR="$_DETECTED_WEB"
fi

BRANCH="${BRANCH:-main}"
PM2_NAME="${PM2_NAME:-rct-ai-web}"
APP_PORT="${APP_PORT:-3000}"

echo "==> [0/8] Paths: APP_ROOT=$APP_ROOT  WEB_DIR=$WEB_DIR"

echo "==> [1/8] Check paths"
if [[ ! -d "$APP_ROOT/.git" ]]; then
  echo "Error: $APP_ROOT is not a git repository."
  exit 1
fi
if [[ ! -f "$WEB_DIR/package.json" ]]; then
  echo "Error: $WEB_DIR/package.json not found."
  exit 1
fi
if [[ ! -f "$WEB_DIR/.env.local" ]]; then
  echo "Error: $WEB_DIR/.env.local 不存在。"
  echo "请执行: cd $WEB_DIR && cp .env.local.example .env.local"
  echo "然后编辑 .env.local，至少设置 ADMIN_USERNAME 与 ADMIN_PASSWORD（及 Supabase 等）。"
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

echo "==> [5/8] Restart PM2 (standalone via ecosystem.config.cjs)"
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true

cd "$WEB_DIR"
export PM2_NAME
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="$APP_PORT"

pm2 start ecosystem.config.cjs

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
