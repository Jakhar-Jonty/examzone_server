#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04 EC2 instance (t3.micro).
# Usage: bash setup-ec2.sh

set -euo pipefail

echo "==> Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

echo "==> Installing PM2..."
sudo npm install -g pm2

echo "==> Creating app directory..."
sudo mkdir -p /var/www/goprep-api
sudo chown -R "$USER:$USER" /var/www/goprep-api

echo "==> Enabling nginx..."
sudo systemctl enable nginx
sudo systemctl start nginx

echo ""
echo "Setup complete."
echo "Next steps:"
echo "  1. Clone your repo into /var/www/goprep-api"
echo "  2. cd /var/www/goprep-api/examzone_server && npm ci --omit=dev"
echo "  3. Create .env with production values"
echo "  4. Copy deploy/nginx.conf to /etc/nginx/sites-available/goprep-api"
echo "  5. sudo ln -s /etc/nginx/sites-available/goprep-api /etc/nginx/sites-enabled/"
echo "  6. sudo nginx -t && sudo systemctl reload nginx"
echo "  7. pm2 start ecosystem.config.cjs && pm2 save && pm2 startup"
