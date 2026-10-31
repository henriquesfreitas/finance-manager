#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Finance Manager — SSL Setup (Let's Encrypt via Certbot)
# Run ONCE on initial deploy, AFTER DNS is pointing to the VPS IP.
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Load env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found."
  exit 1
fi

set -a
source .env
set +a

if [ -z "${DOMAIN:-}" ]; then
  echo "ERROR: DOMAIN not set in .env"
  exit 1
fi

EMAIL="${CERTBOT_EMAIL:-}"
if [ -z "$EMAIL" ]; then
  read -p "Enter email for Let's Encrypt notifications: " EMAIL
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  SSL Setup for: $DOMAIN"
echo "══════════════════════════════════════════════════════════════"

# Create certbot directories
mkdir -p certbot/www certbot/conf

# Step 1: Start nginx with HTTP-only config for ACME challenge
echo "→ Starting nginx for ACME challenge..."

# Create temporary HTTP-only nginx config
cat > nginx/conf.d/default.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

docker compose -f docker-compose.prod.yml up -d nginx

sleep 3

# Step 2: Request certificate
echo "→ Requesting SSL certificate..."
docker run --rm \
  -v "$PROJECT_DIR/certbot/www:/var/www/certbot" \
  -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 3: Restore full HTTPS nginx config
echo "→ Restoring HTTPS nginx config..."
cat > nginx/conf.d/default.conf << 'NGINXEOF'
resolver 127.0.0.11 valid=10s;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl;
    http2 on;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        set $backend server:3000;
        proxy_pass http://$backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api burst=50 nodelay;
        set $backend server:3000;
        proxy_pass http://$backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        set $backend server:3000;
        proxy_pass http://$backend;
        proxy_set_header Host $host;
    }

    location / {
        set $backend client:80;
        proxy_pass http://$backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF

# Replace placeholder with actual domain
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/conf.d/default.conf

# Step 4: Reload Nginx without stopping the database or app containers
echo "→ Restarting Nginx with HTTPS..."
docker compose -f docker-compose.prod.yml up -d nginx
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✓ SSL setup complete!"
echo "  → https://$DOMAIN"
echo "  → Run bash scripts/setup-prod-config.sh to install the app schedules and daily renewal"
echo "══════════════════════════════════════════════════════════════"
