#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Finance Manager — Self-Signed SSL for IP-only deployment
# Use when no domain is available. Browser shows a warning once, but traffic
# is encrypted (credentials/cookies protected in transit).
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

IP="${DOMAIN:-89.168.73.181}"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Self-Signed SSL Setup for IP: $IP"
echo "══════════════════════════════════════════════════════════════"

# Create SSL directory
SSL_DIR="$PROJECT_DIR/nginx/ssl"
mkdir -p "$SSL_DIR"

# Generate self-signed certificate (valid 10 years)
echo "→ Generating self-signed certificate..."
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/C=BR/ST=SP/L=SP/O=Finance Manager/CN=$IP" \
  -addext "subjectAltName=IP:$IP"

chmod 600 "$SSL_DIR/privkey.pem"

echo "→ Writing nginx HTTPS config..."

cat > nginx/conf.d/default.conf << EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server (self-signed)
server {
    listen 443 ssl;
    http2 on;
    server_name _;

    resolver 127.0.0.11 valid=10s;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API proxy — rate limited
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        set \$backend_server server:3000;
        proxy_pass http://\$backend_server;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        limit_req zone=api burst=50 nodelay;
        set \$backend_server server:3000;
        proxy_pass http://\$backend_server;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    # Health check (no rate limit)
    location /health {
        set \$backend_server server:3000;
        proxy_pass http://\$backend_server;
        proxy_set_header Host \$host;
    }

    # Static frontend
    location / {
        set \$backend_client client:80;
        proxy_pass http://\$backend_client;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✓ Self-signed SSL ready!"
echo "  → Certificate: $SSL_DIR/fullchain.pem"
echo "  → Key: $SSL_DIR/privkey.pem"
echo ""
echo "  Next: run 'bash scripts/deploy.sh'"
echo "  Access: https://$IP"
echo "  (Browser will warn about self-signed cert — accept once)"
echo "══════════════════════════════════════════════════════════════"
