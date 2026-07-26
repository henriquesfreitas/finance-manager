#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Finance Manager — VPS Initial Setup (Oracle Ubuntu 24.04)
# Run this ONCE on a fresh VPS to configure security + Docker.
# Execute as: sudo bash scripts/setup-vps.sh
# ══════════════════════════════════════════════════════════════════════════════

echo "══════════════════════════════════════════════════════════════"
echo "  VPS Security & Environment Setup"
echo "══════════════════════════════════════════════════════════════"

# ── System updates ────────────────────────────────────────────────────────────
echo "→ Updating system packages..."
apt update && apt upgrade -y

# ── Firewall (UFW) ────────────────────────────────────────────────────────────
echo "→ Configuring firewall..."
apt install -y ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS

echo "y" | ufw enable
ufw status verbose

# ── Fail2ban ──────────────────────────────────────────────────────────────────
echo "→ Installing fail2ban..."
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# ── SSH hardening ─────────────────────────────────────────────────────────────
echo "→ Hardening SSH..."
# Disable password auth (key-only)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
# Disable root login
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

systemctl reload sshd

# ── Docker (if not installed) ─────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu
  systemctl enable docker
  echo "  NOTE: Log out and back in for docker group to take effect."
else
  echo "→ Docker already installed."
fi

# ── Docker Compose (plugin) ──────────────────────────────────────────────────
if ! docker compose version &> /dev/null; then
  echo "→ Installing Docker Compose plugin..."
  apt install -y docker-compose-plugin
else
  echo "→ Docker Compose already installed."
fi

# ── Automatic security updates ────────────────────────────────────────────────
echo "→ Enabling automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# ── Swap file (Oracle free tier has limited RAM) ──────────────────────────────
if [ ! -f /swapfile ]; then
  echo "→ Creating 2GB swap file..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Optimize swap usage
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  echo "→ Swap already configured."
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✓ VPS setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Log out and back in (for docker group)"
echo "  2. Copy .env.production.example to .env and fill in values"
echo "  3. Point your domain DNS A record to this server's IP"
echo "  4. Run: bash scripts/setup-ssl.sh"
echo "  5. Run: bash scripts/deploy.sh"
echo "══════════════════════════════════════════════════════════════"
