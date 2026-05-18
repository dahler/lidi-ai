#!/bin/bash
set -euo pipefail

APP_DIR="/home/${USER}/app"
STAGING="/home/${USER}/frontends.tar.gz"

echo "==> Pulling latest backend code"
cd "$APP_DIR"
git pull origin main

echo "==> Installing Python dependencies"
source .venv/bin/activate
pip install -r backend/requirements.txt -q

echo "==> Running database migrations"
cd backend
python -m alembic upgrade head
cd "$APP_DIR"

echo "==> Restarting API"
sudo systemctl restart lidi-api

echo "==> Deploying frontends"
cd /home/${USER}
tar -xzf "$STAGING"

sudo rsync -a --delete frontend-dashboard/dist/ /var/www/dashboard/
sudo rsync -a --delete frontend-admin/dist/ /var/www/admin/
sudo rsync -a --delete frontend-widget/dist/ /var/www/widget/

rm -f "$STAGING"
rm -rf frontend-dashboard frontend-admin frontend-widget

echo "==> Done ✓"
