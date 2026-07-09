#!/usr/bin/env bash
# Run on EC2 after code updates.
# Usage: bash deploy/deploy.sh

set -euo pipefail

APP_DIR="/var/www/goprep-api/examzone_server"

cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing dependencies..."
npm ci --omit=dev

echo "==> Restarting API..."
pm2 restart goprep-api || pm2 start ecosystem.config.cjs
pm2 save

echo "==> Done. Check: curl http://127.0.0.1:8000/api/health"
