#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Pulling latest code"
cd "$APP_DIR"
git pull origin main

echo "==> Rebuilding and restarting containers"
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d

echo "==> Done ✓"
docker compose -f docker-compose.prod.yml ps
