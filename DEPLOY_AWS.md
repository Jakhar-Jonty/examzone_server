# Deploy GoPrep API on AWS EC2 (t3.micro)

Frontend stays on **Vercel**. Backend moves to **EC2** for a always-on server + Socket.io.

## 1. Launch EC2

1. AWS Console → EC2 → Launch instance
2. **AMI:** Ubuntu 22.04 LTS
3. **Type:** t3.micro (free tier)
4. **Key pair:** create/download `.pem`
5. **Security group inbound:**
   - SSH `22` — your IP only
   - HTTP `80` — `0.0.0.0/0`
   - HTTPS `443` — `0.0.0.0/0` (optional, for SSL later)
6. Launch → note **Public IPv4** (e.g. `54.123.45.67`)

## 2. MongoDB Atlas

Atlas → Network Access → add EC2 **Elastic IP** (or `0.0.0.0/0` for testing only).

## 3. SSH into server

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

## 4. One-time server setup

```bash
# On EC2 — clone repo (or upload examzone_server folder)
git clone YOUR_REPO_URL /var/www/goprep-api
cd /var/www/goprep-api/examzone_server

bash deploy/setup-ec2.sh

npm ci --omit=dev
cp .env.example .env
nano .env   # paste production values (no quotes around MONGODB_URI)
```

## 5. Nginx reverse proxy

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/goprep-api
sudo nano /etc/nginx/sites-available/goprep-api
# Replace YOUR_DOMAIN_OR_IP with your EC2 public IP or domain

sudo ln -sf /etc/nginx/sites-available/goprep-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Start API with PM2

```bash
cd /var/www/goprep-api/examzone_server
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # run the command it prints
```

Verify:

```bash
curl http://127.0.0.1:8000/api/health
curl http://YOUR_EC2_IP/api/health
```

## 7. Point frontend to AWS

### Option A — Direct (recommended for Socket.io live leaderboard)

Vercel project → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `http://YOUR_EC2_IP/api` |

Redeploy frontend. API + WebSocket go straight to EC2.

### Option B — Vercel proxy (API only)

Edit `examzone_client/vercel.json`:

```json
"destination": "http://YOUR_EC2_IP/api/:path*"
```

Still set `VITE_API_BASE_URL=http://YOUR_EC2_IP/api` for **live leaderboard sockets** (Vercel cannot proxy WebSockets reliably).

## 8. Mobile app

Set in EAS / `app.json` extra or `.env`:

```
EXPO_PUBLIC_API_URL=http://YOUR_EC2_IP/api
```

Rebuild APK after changing.

## 9. Future deploys

On EC2 after pushing to `main`:

```bash
cd /var/www/goprep-api/examzone_server
bash deploy/deploy.sh
```

## 10. HTTPS (optional)

Point a domain A-record to EC2 IP, then:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.yourdomain.com
```

Update `VITE_API_BASE_URL` to `https://api.yourdomain.com/api`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Database connection failed` | Check Atlas IP whitelist + `MONGODB_URI` in `.env` |
| `502 Bad Gateway` | `pm2 status` → `pm2 logs goprep-api` |
| Leaderboard not live | Set `VITE_API_BASE_URL` to EC2 (not Vercel origin) |
| Mobile can't connect | Use EC2 public IP; phone must reach internet (not localhost) |

## Files added

- `ecosystem.config.cjs` — PM2 process manager
- `deploy/setup-ec2.sh` — first-time EC2 setup
- `deploy/deploy.sh` — pull + restart
- `deploy/nginx.conf` — reverse proxy + WebSocket support
- `.env.example` — required env vars template
