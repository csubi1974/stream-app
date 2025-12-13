# Deployment Guide for Hostinger VPS

## Prerequisites
- VPS IP: 72.61.63.62
- SSH access configured
- Docker and Docker Compose installed on VPS

## Step 1: Initial VPS Setup

Connect to your VPS via SSH from Hostinger panel or terminal:
```bash
ssh root@72.61.63.62
```

Run the setup script:
```bash
bash setup-vps.sh
```

## Step 2: Configure SSH Key

Add your public SSH key to the VPS:
```bash
# On your local machine
type %USERPROFILE%\.ssh\hostinger_vps.pub | ssh root@72.61.63.62 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

## Step 3: Configure Environment Variables

Edit `.env.production` with your production credentials:
- PostgreSQL password
- Schwab API credentials
- Domain name (if you have one)

## Step 4: Deploy Application

### Option A: Using the deploy script (Linux/Mac/WSL)
```bash
chmod +x deploy.sh
./deploy.sh
```

### Option B: Manual deployment (Windows)

1. Build the application:
```powershell
npm run build
```

2. Copy files to VPS:
```powershell
scp -i $env:USERPROFILE\.ssh\hostinger_vps -r * root@72.61.63.62:/var/www/tape-reading/
```

3. SSH into VPS and start services:
```bash
ssh -i %USERPROFILE%\.ssh\hostinger_vps root@72.61.63.62
cd /var/www/tape-reading
docker-compose up -d --build
```

## Step 5: Verify Deployment

Check if services are running:
```bash
docker-compose ps
docker-compose logs -f
```

Access your application:
- Frontend: http://72.61.63.62
- API: http://72.61.63.62/api/health

## Troubleshooting

### Check logs
```bash
docker-compose logs app
docker-compose logs postgres
docker-compose logs redis
```

### Restart services
```bash
docker-compose restart
```

### Rebuild and restart
```bash
docker-compose down
docker-compose up -d --build
```

## Domain Configuration (Optional)

If you have a domain, configure DNS:
1. Add A record pointing to 72.61.63.62
2. Update SCHWAB_REDIRECT_URI in .env.production
3. Configure SSL with Let's Encrypt:
```bash
docker-compose exec nginx certbot --nginx -d yourdomain.com
```
