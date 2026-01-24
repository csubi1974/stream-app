import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { SchwabService } from './services/schwabService.js';
import { MarketDataService } from './services/marketDataService.js';
import { WebSocketHandler } from './websocket/handler.js';
import { setupRoutes } from './routes/index.js';
import { setupDatabase } from './database/setup.js';
import { initializeDb } from './database/sqlite.js';
import { initializePostgres } from './database/postgres.js';
import { DataRecorderService } from './services/dataRecorderService.js';

dotenv.config();

const app = express();
const server = createServer(app);
// Use noServer mode so we can share wss between HTTP and HTTPS
const wss = new WebSocketServer({ noServer: true });

// Setup paths
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../dist');

// Initialize services
const schwabService = new SchwabService();
const marketDataService = new MarketDataService(schwabService);
const wsHandler = new WebSocketHandler(wss, marketDataService, schwabService);

// Middleware: Intercept Schwab Auth Code BEFORE static files
app.use(async (req, res, next) => {
  if ((req.path === '/' || req.path === '/callback') && req.query.code) {
    console.log('🔐 Intercepting Schwab Auth Code');
    try {
      await schwabService.exchangeCode(req.query.code as string);
      res.send(`
        <html>
          <body style="background:#111827; color:white; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh;">
            <div style="text-align:center;">
              <h1 style="color:#4ade80;">✅ Autenticación Exitosa</h1>
              <p>Tokens guardados correctamente.</p>
              <p style="color:#9ca3af;">Puedes cerrar esta ventana.</p>
              <script>setTimeout(() => window.close(), 2000)</script>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      console.error('Auth Error:', e);
      res.status(500).send('Authentication Failed');
    }
  } else {
    next();
  }
});

// Serve static files from dist FIRST
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log('📂 Serving static files from ' + distPath);
} else {
  console.log('⚠️  Dist folder not found at ' + distPath);
}

const wssInstance = wss; // Helper just in case

// Middleware
app.use(cors());
app.use(express.json());

// Handle WebSocket Upgrades for HTTP
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Initialize services
// Services initialized above

// Setup routes and start server
async function startServer() {
  try {
    // Setup database (Redis & Mocks)
    console.log('🔄 Connecting to Redis...');
    await setupDatabase();
    console.log('✅ Redis Connected');

    // Setup Historical DB (PostgreSQL)
    try {
      console.log('🔄 Connecting to Postgres...');
      await initializePostgres();
      console.log('✅ Postgres Connected');
    } catch (dbError) {
      console.warn('⚠️ Postgres connection failed - Historical Data features will be disabled.');
      // Do not exit process, allow server to run without DB
    }

    // Setup Persistence DB (SQLite)
    try {
      console.log('🔄 Initializing SQLite Database...');
      await initializeDb();
      console.log('✅ SQLite Initialized');
    } catch (sqliteError) {
      console.error('❌ Failed to initialize SQLite database:', sqliteError);
    }

    // Setup routes
    setupRoutes(app, schwabService, marketDataService);

    // SPA Fallback
    if (fs.existsSync(distPath)) {
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    // WebSocket connection handling
    wsHandler.initialize();

    const PORT = Number(process.env.PORT) || 3002;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Tape Reading Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`📼 Data Recording active (SPX Snapshots)`);
    });

  } catch (error) {
    console.error('❌ FATAL ERROR starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Force restart
const SSL_ENABLED = process.env.SSL_ENABLED === 'true';
if (SSL_ENABLED) {
  const SSL_PORT = Number(process.env.SSL_PORT || 8001);
  const keyPath = process.env.SSL_KEY_PATH || '';
  const certPath = process.env.SSL_CERT_PATH || '';
  const pfxPath = process.env.SSL_PFX_PATH || '';
  const pfxPass = process.env.SSL_PFX_PASSPHRASE || '';
  try {
    const httpsOptions: any = {};
    if (pfxPath) {
      httpsOptions.pfx = fs.readFileSync(pfxPath);
      if (pfxPass) httpsOptions.passphrase = pfxPass;
    } else {
      httpsOptions.key = fs.readFileSync(keyPath);
      httpsOptions.cert = fs.readFileSync(certPath);
    }
    const httpsServer = createHttpsServer(httpsOptions, app);

    // Attach WebSocket Upgrade to HTTPS Server too
    httpsServer.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    httpsServer.listen(SSL_PORT, () => {
      console.log(`🔐 HTTPS callback server on port ${SSL_PORT}`);
      console.log(`📡 Secure WebSocket (WSS) ready on port ${SSL_PORT}`);
    });
  } catch (e) {
    console.error('❌ HTTPS server failed to start', e);
  }
}

