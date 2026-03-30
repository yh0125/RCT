#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo bash scripts/deploy_tencent.sh
#
# Required env vars before running:
#   APP_DOMAIN            e.g. rct-ai.example.com
#   APP_REPO_URL          e.g. https://github.com/you/rct-ai.git
#   APP_REPO_BRANCH       e.g. main
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_TARGET_ENROLLMENT
#   AI_API_URL
#   AI_API_KEY
#   AI_MODEL
#   AI_PROMPT_MODEL       (optional)
#   AI_IMAGE_MODEL
#   AI_IMAGE_REFERENCE_URL (optional)
#
# Optional:
#   APP_DIR               default /opt/rct-ai
#   APP_PORT              default 3000
#   ENABLE_HTTPS          default true
#   EMAIL_FOR_SSL         certbot registration email (required if ENABLE_HTTPS=true)

APP_DIR="${APP_DIR:-/opt/rct-ai}"
APP_PORT="${APP_PORT:-3000}"
APP_DOMAIN="${APP_DOMAIN:-}"
APP_REPO_URL="${APP_REPO_URL:-}"
APP_REPO_BRANCH="${APP_REPO_BRANCH:-main}"
ENABLE_HTTPS="${ENABLE_HTTPS:-true}"
EMAIL_FOR_SSL="${EMAIL_FOR_SSL:-}"

need_var() {
  local k="$1"
  if [[ -z "${!k:-}" ]]; then
    echo "Missing required env: $k"
    exit 1
  fi
}

need_var APP_DOMAIN
need_var APP_REPO_URL
need_var NEXT_PUBLIC_SUPABASE_URL
need_var NEXT_PUBLIC_SUPABASE_ANON_KEY
need_var NEXT_PUBLIC_TARGET_ENROLLMENT
need_var AI_API_URL
need_var AI_API_KEY
need_var AI_MODEL
need_var AI_IMAGE_MODEL

if [[ "$ENABLE_HTTPS" == "true" ]]; then
  need_var EMAIL_FOR_SSL
fi

echo "==> Install system dependencies"
apt update
apt -y install curl git nginx certbot python3-certbot-nginx

echo "==> Install Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt -y install nodejs
fi

echo "==> Install PM2"
npm i -g pm2

echo "==> Prepare app directory"
mkdir -p "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$APP_REPO_BRANCH" "$APP_REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$APP_REPO_BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$APP_REPO_BRANCH"
fi

WEB_DIR="$APP_DIR/web"
if [[ ! -d "$WEB_DIR" ]]; then
  echo "Cannot find $WEB_DIR. Check APP_REPO_URL structure."
  exit 1
fi

echo "==> Write production env file"
cat > "$WEB_DIR/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
NEXT_PUBLIC_SITE_URL=https://${APP_DOMAIN}
NEXT_PUBLIC_TARGET_ENROLLMENT=${NEXT_PUBLIC_TARGET_ENROLLMENT}

AI_API_URL=${AI_API_URL}
AI_API_KEY=${AI_API_KEY}
AI_MODEL=${AI_MODEL}
AI_PROMPT_MODEL=${AI_PROMPT_MODEL:-}
AI_IMAGE_MODEL=${AI_IMAGE_MODEL}
AI_IMAGE_REFERENCE_URL=${AI_IMAGE_REFERENCE_URL:-}
EOF

echo "==> Install dependencies and build"
cd "$WEB_DIR"
npm ci
npm run build

echo "==> Start app with PM2"
pm2 delete rct-ai-web >/dev/null 2>&1 || true
pm2 start "npm run start -- -p ${APP_PORT}" --name rct-ai-web --cwd "$WEB_DIR"
pm2 save

echo "==> Configure Nginx"
cat > /etc/nginx/sites-available/rct-ai <<EOF
server {
    listen 80;
    server_name ${APP_DOMAIN} www.${APP_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # C 组 AI 解读 + 文生图可能 >60s，缺省会导致浏览器 504 Gateway Time-out
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/rct-ai /etc/nginx/sites-enabled/rct-ai
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ "$ENABLE_HTTPS" == "true" ]]; then
  echo "==> Request Let's Encrypt certificate"
  certbot --nginx \
    -d "${APP_DOMAIN}" \
    -d "www.${APP_DOMAIN}" \
    --agree-tos \
    --non-interactive \
    -m "${EMAIL_FOR_SSL}" \
    --redirect
fi

echo "==> Deployment done"
echo "URL: https://${APP_DOMAIN}/p"
echo "Admin: https://${APP_DOMAIN}/admin"
