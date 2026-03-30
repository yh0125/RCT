# Tencent Cloud One-Click Deploy

This guide deploys the `web` app to Tencent Cloud Ubuntu server with:
- Node.js 20
- PM2
- Nginx reverse proxy
- Let's Encrypt HTTPS

## 0. Prerequisites

- A Tencent Cloud Ubuntu 22.04 server
- Domain already resolved to server public IP:
  - `A @ -> <SERVER_IP>`
  - `A www -> <SERVER_IP>`
- Security group ports open: `22`, `80`, `443`
- Your project pushed to a Git repository

## 1. SSH into server

```bash
ssh ubuntu@<SERVER_IP>
sudo -i
```

## 2. Clone repo and run deploy script

```bash
git clone <YOUR_REPO_URL> /opt/rct-ai
cd /opt/rct-ai
chmod +x web/scripts/deploy_tencent.sh
```

Run with env vars (replace placeholders):

```bash
APP_DOMAIN="your-domain.com" \
APP_REPO_URL="<YOUR_REPO_URL>" \
APP_REPO_BRANCH="main" \
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="xxxx" \
NEXT_PUBLIC_TARGET_ENROLLMENT="100" \
AI_API_URL="https://ai.t8star.cn/v1/chat/completions" \
AI_API_KEY="xxxx" \
AI_MODEL="gemini-3.1-flash-lite-preview" \
AI_PROMPT_MODEL="gemini-3.1-flash-lite-preview-thinking-high" \
AI_IMAGE_MODEL="gemini-3.1-flash-image-preview" \
AI_IMAGE_REFERENCE_URL="" \
ENABLE_HTTPS="true" \
EMAIL_FOR_SSL="you@example.com" \
bash web/scripts/deploy_tencent.sh
```

## 3. Verify

- Patient entry: `https://your-domain.com/p`
- Admin: `https://your-domain.com/admin`
- PM2 status:

```bash
pm2 status
pm2 logs rct-ai-web --lines 100
```

## 4. Update release later

```bash
cd /opt/rct-ai
git pull
cd web
npm ci
npm run build
pm2 restart rct-ai-web
```

Or run one command with the auto-update script:

```bash
sudo bash /opt/rct-ai/web/scripts/update_server.sh
```

## 5. Troubleshooting

- Nginx test:
```bash
nginx -t
systemctl status nginx
```

- Check local app:
```bash
curl -I http://127.0.0.1:3000
```

- Re-issue SSL:
```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```
