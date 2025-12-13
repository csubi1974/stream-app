# Quick Deployment Guide (Manual)

## Option 1: Using Hostinger File Manager (Easiest)

1. Build your application locally:
   ```powershell
   npm run build
   ```

2. Go to Hostinger Panel → Your VPS → File Manager

3. Upload these files/folders to `/var/www/tape-reading/`:
   - `dist/` (built frontend)
   - `api/` (backend code)
   - `package.json`
   - `package-lock.json`
   - `docker-compose.yml`
   - `Dockerfile`
   - `nginx.conf`
   - `.env.production` (rename to `.env`)

4. Open Terminal in Hostinger Panel and run:
   ```bash
   cd /var/www/tape-reading
   npm install --production
   docker-compose up -d --build
   ```

## Option 2: Using Git (Recommended after MCP setup)

1. Create a GitHub repository for your project
2. Push your code:
   ```powershell
   git remote add origin https://github.com/your-username/tape-reading.git
   git push -u origin main
   ```

3. In Hostinger VPS terminal:
   ```bash
   cd /var/www
   git clone https://github.com/your-username/tape-reading.git
   cd tape-reading
   npm install --production
   docker-compose up -d --build
   ```

## Option 3: Wait for MCP (Automated - Best)

After restarting the conversation with MCP enabled, I'll be able to:
- Deploy directly from your local machine
- Manage files on the VPS
- Execute commands remotely
- Monitor the deployment

## Current Status

✅ Docker configuration ready
✅ Nginx reverse proxy configured
✅ PostgreSQL + Redis setup ready
✅ Environment variables template created
✅ MCP configuration file created

⏳ Waiting for MCP activation (restart conversation)

## Next Steps After MCP Activation

1. I'll connect to your VPS using the MCP
2. Upload all necessary files
3. Install Docker and dependencies
4. Deploy the application
5. Configure domain (if you have one)
6. Setup SSL certificate

Your VPS IP: 72.61.63.62
