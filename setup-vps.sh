#!/bin/bash

# Initial VPS setup script
# Run this on your Hostinger VPS as root

set -e

echo "🔧 Setting up VPS for Tape Reading Platform..."

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
echo "📦 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js (for build tools)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /var/www/tape-reading
chown -R $USER:$USER /var/www/tape-reading

# Setup firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3002/tcp
ufw --force enable

# Install additional tools
echo "🛠️ Installing additional tools..."
apt-get install -y git curl wget htop

echo "✅ VPS setup completed!"
echo "📝 Next steps:"
echo "1. Copy your SSH public key to ~/.ssh/authorized_keys"
echo "2. Deploy the application using the deploy script"
