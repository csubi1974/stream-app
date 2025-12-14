# Deployment script for Hostinger VPS
# Run this script from PowerShell to deploy your application

$VPS_IP = "72.61.63.62"
$VPS_USER = "root"
$VPS_PATH = "/var/www/tape-reading"
$SSH_KEY = "$env:USERPROFILE\.ssh\hostinger_vps"

Write-Host "🚀 Starting deployment to Hostinger VPS..." -ForegroundColor Green

# Step 1: Build the application (already done)
Write-Host "`n📦 Build completed successfully" -ForegroundColor Green

# Step 2: Create deployment package
Write-Host "`n📁 Creating deployment package..." -ForegroundColor Yellow

$deployFiles = @(
    "dist",
    "api",
    "package.json",
    "package-lock.json",
    "docker-compose.yml",
    "Dockerfile",
    "nginx.conf",
    ".env.production",
    "tokens.json",
    "certs"
)

# Step 3: Instructions for manual deployment
Write-Host "`n📋 Deployment Instructions:" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Using SCP (Recommended)" -ForegroundColor Yellow
Write-Host "Run the following commands:" -ForegroundColor White
Write-Host ""
Write-Host "# Create directory on VPS" -ForegroundColor Gray
Write-Host "ssh -i `"$SSH_KEY`" $VPS_USER@$VPS_IP `"mkdir -p $VPS_PATH`"" -ForegroundColor White
Write-Host ""
Write-Host "# Copy files to VPS" -ForegroundColor Gray
Write-Host "scp -i `"$SSH_KEY`" -r dist api package.json package-lock.json docker-compose.yml Dockerfile nginx.conf .env.production tokens.json certs $VPS_USER@${VPS_IP}:$VPS_PATH/" -ForegroundColor White
Write-Host ""
Write-Host "# SSH into VPS and start services" -ForegroundColor Gray
Write-Host "ssh -i `"$SSH_KEY`" $VPS_USER@$VPS_IP" -ForegroundColor White
Write-Host "cd $VPS_PATH" -ForegroundColor White
Write-Host "mv .env.production .env" -ForegroundColor White
Write-Host "docker-compose up -d --build" -ForegroundColor White
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 2: Using Hostinger File Manager" -ForegroundColor Yellow
Write-Host "1. Go to Hostinger Panel → Your VPS → File Manager" -ForegroundColor White
Write-Host "2. Navigate to /var/www/tape-reading/" -ForegroundColor White
Write-Host "3. Upload the following folders/files:" -ForegroundColor White
foreach ($file in $deployFiles) {
    Write-Host "   - $file" -ForegroundColor Gray
}
Write-Host "4. Open Terminal in Hostinger Panel" -ForegroundColor White
Write-Host "5. Run these commands:" -ForegroundColor White
Write-Host "   cd /var/www/tape-reading" -ForegroundColor Gray
Write-Host "   mv .env.production .env" -ForegroundColor Gray
Write-Host "   docker-compose up -d --build" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT: Before deploying, update .env.production with:" -ForegroundColor Red
Write-Host "   - PostgreSQL password" -ForegroundColor White
Write-Host "   - Schwab API credentials" -ForegroundColor White
Write-Host "   - Your domain name (if you have one)" -ForegroundColor White
Write-Host ""
Write-Host "✅ After deployment, access your app at:" -ForegroundColor Green
Write-Host "   Frontend: http://$VPS_IP" -ForegroundColor Cyan
Write-Host "   API Health: http://$VPS_IP/api/health" -ForegroundColor Cyan
Write-Host ""
