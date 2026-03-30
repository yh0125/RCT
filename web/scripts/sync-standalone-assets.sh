#!/usr/bin/env bash
# 每次 npm run build 后必须把静态资源拷入 standalone，否则 /_next/static/* 会 404。
# 用法（在 web/ 下）: bash scripts/sync-standalone-assets.sh
set -euo pipefail
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAND="$WEB_DIR/.next/standalone"

if [[ ! -d "$WEB_DIR/.next/static" ]]; then
  echo "Error: $WEB_DIR/.next/static 不存在，请先在该目录执行: npm run build"
  exit 1
fi
if [[ ! -f "$STAND/server.js" ]]; then
  echo "Error: $STAND/server.js 不存在，请先 npm run build（需 output: standalone）"
  exit 1
fi

mkdir -p "$STAND/.next"
rm -rf "$STAND/.next/static"
cp -r "$WEB_DIR/.next/static" "$STAND/.next/static"
if [[ -d "$WEB_DIR/public" ]]; then
  rm -rf "$STAND/public"
  cp -r "$WEB_DIR/public" "$STAND/public"
fi

NFILES=$(find "$STAND/.next/static" -type f 2>/dev/null | wc -l)
echo "OK: synced .next/static -> standalone ($NFILES files). Restart PM2: pm2 restart rct-ai-web"
