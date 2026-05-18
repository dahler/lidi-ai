#!/bin/bash
set -euo pipefail

# ── Usage: ./setup-prod.sh yourdomain.com your@email.com ─────────────
DOMAIN="${1:?Usage: ./setup-prod.sh yourdomain.com your@email.com}"
EMAIL="${2:?Usage: ./setup-prod.sh yourdomain.com your@email.com}"

echo "==> Setting up Lidi AI for $DOMAIN"

# 1. Create .env.prod if it doesn't exist
if [ ! -f .env.prod ]; then
  cp .env.prod.example .env.prod
  echo ""
  echo "!! .env.prod created from template."
  echo "!! Edit it now with your real values, then re-run this script."
  echo "   nano .env.prod"
  exit 0
fi

# 2. Generate nginx config from template (replace DOMAIN placeholder)
sed "s/\${DOMAIN}/$DOMAIN/g" nginx/nginx.prod.conf.template > nginx/nginx.prod.conf
echo "==> Nginx config generated for $DOMAIN"

# 3. Start nginx with HTTP-only config to get SSL certificates
cp nginx/nginx.init.conf nginx/nginx.prod.conf
docker compose -f docker-compose.prod.yml up -d nginx certbot
echo "==> Nginx started (HTTP only)"

# 4. Get SSL certificates
echo "==> Requesting SSL certificates..."
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "app.$DOMAIN" \
  -d "admin.$DOMAIN" \
  -d "widget.$DOMAIN"

# 5. Switch to full nginx config with HTTPS
sed "s/\${DOMAIN}/$DOMAIN/g" nginx/nginx.prod.conf.template > nginx/nginx.prod.conf
echo "==> SSL certificates obtained, switching to HTTPS config"

# 6. Start all services
docker compose -f docker-compose.prod.yml up -d
echo ""
echo "==> Done! Lidi AI is running at:"
echo "    https://app.$DOMAIN    (dashboard)"
echo "    https://admin.$DOMAIN  (admin panel)"
echo "    https://widget.$DOMAIN (widget)"
