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
import { DataRecorderService } from './services/dataRecorderService.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const schwabService = new SchwabService();
const marketDataService = new MarketDataService();
const wsHandler = new WebSocketHandler(wss, marketDataService);

// Setup database (Redis & Mocks)
await setupDatabase();
// Setup Historical DB (SQLite)
// await initializeDb();

// Start Recorder
// const recorderService = new DataRecorderService(schwabService);
// Start recording every 5 minutes (300000ms) to avoid blocking too much for now
// recorderService.startRecording(300000);

// Setup routes
setupRoutes(app, schwabService, marketDataService);

// WebSocket connection handling
wsHandler.initialize();

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`🚀 Tape Reading Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`📼 Data Recording active (SPX Snapshots)`);
});

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
    httpsServer.listen(SSL_PORT, () => {
      console.log(`🔐 HTTPS callback server on port ${SSL_PORT}`);
    });
  } catch (e) {
    console.error('❌ HTTPS server failed to start');
  }
}

