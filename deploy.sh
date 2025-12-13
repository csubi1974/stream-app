#!/bin/bash

# Deployment script for Hostinger VPS
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment to Hostinger VPS..."

# Configuration
VPS_IP="72.61.63.62"
VPS_USER="root"
APP_DIR="/var/www/tape-reading"

echo "📦 Building application..."
npm run build

echo "📤 Uploading files to VPS..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '*.db' \
  ./ ${VPS_USER}@${VPS_IP}:${APP_DIR}/

echo "🔧 Installing dependencies and starting services on VPS..."
ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
cd /var/www/tape-reading

# Install dependencies
npm ci --only=production

# Stop existing services
docker-compose down || true

# Start services
docker-compose up -d --build

# Show status
docker-compose ps

echo "✅ Deployment completed!"
ENDSSH

echo "🎉 Application deployed successfully!"
echo "🌐 Access your app at: http://${VPS_IP}"
