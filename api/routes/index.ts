import express from 'express';
import { SchwabService } from '../services/schwabService.js';
import { MarketDataService } from '../services/marketDataService.js';
import { createSchwabAuthRouter } from './schwabAuth.js';
import gexRouter from './gex.js';
import alertsRouter from './alerts.js';
import calendarRouter from './calendar.js';
import testRouter from './test.js';
import { createBacktestRouter } from './backtest.js';

export function setupRoutes(
  app: express.Application,
  schwabService: SchwabService,
  marketDataService: MarketDataService
) {
  // Mount Schwab Auth Routes
  app.use('/api/auth/schwab', createSchwabAuthRouter(schwabService));

  // Mount GEX Metrics Routes
  app.use('/api/gex', gexRouter);

  // Mount Trade Alerts Routes
  app.use('/api/alerts', alertsRouter);

  // Mount Backtest Routes
  app.use('/api/backtest', createBacktestRouter(schwabService));

  // Mount Calendar & News Routes
  app.use('/api/calendar', calendarRouter);

  // Mount Test Routes (for diagnostics)
  app.use('/api/test', testRouter);

  // Legacy callback support (minimal)
  app.get(['/callback', '/'], async (req, res) => {
    const code = req.query.code as string;
    if (code) {
      try {
        await schwabService.exchangeCode(code);
        res.send('<html><body><h1>✅ Connected!</h1><p>You can close this window now.</p><script>window.close()</script></body></html>');
      } catch (e) {
        res.status(500).send('Authentication failed');
      }
    } else {
      res.json({ status: 'ok', service: 'Stream API' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      schwab_connected: schwabService.isConnected()
    });
  });

  // Options book endpoint
  app.get('/api/options-book/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { levels = 10 } = req.query;

      const bookData = await schwabService.getOptionsBook(symbol, Number(levels));
      res.json(bookData);
    } catch (error) {
      console.error('❌ Options book error:', error);
      res.status(500).json({ error: 'Failed to fetch options book' });
    }
  });

  // Options chain endpoint
  app.get('/api/chain/:underlying', async (req, res) => {
    try {
      const { underlying } = req.params;
      const chainData = await schwabService.getOptionsChain(underlying);
      res.json(chainData);
    } catch (error) {
      console.error('❌ Options chain error:', error);
      res.status(500).json({ error: 'Failed to fetch options chain' });
    }
  });

  // Time & Sales endpoint
  app.get('/api/time-sales/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const trades = await schwabService.getTimeAndSales(symbol);
      res.json(trades);
    } catch (error) {
      console.error('❌ Time & Sales error:', error);
      res.status(500).json({ error: 'Failed to fetch time & sales' });
    }
  });

  // Volume scanner endpoint
  app.get('/api/scanner/volume', async (req, res) => {
    try {
      const { min_rvol = 3, min_dollar_vol = 50000000, sector } = req.query;

      const scannerData = await marketDataService.getVolumeScanner(
        Number(min_rvol),
        Number(min_dollar_vol)
      );

      res.json(scannerData);
    } catch (error) {
      console.error('❌ Volume scanner error:', error);
      res.status(500).json({ error: 'Failed to fetch volume scanner data' });
    }
  });

  // 0DTE options scanner endpoint
  app.get('/api/scanner/0dte', async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'SPX';
      const zeroDTEOptions = await marketDataService.getZeroDTEOptions(symbol);
      res.json(zeroDTEOptions);
    } catch (error) {
      console.error('❌ 0DTE scanner error:', error);
      res.status(500).json({ error: 'Failed to fetch 0DTE options' });
    }
  });

  // Trade history endpoint
  app.get('/api/trade-history/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { limit = 100 } = req.query;

      const history = await marketDataService.getTradeHistory(symbol, Number(limit));
      res.json(history);
    } catch (error) {
      console.error('❌ Trade history error:', error);
      res.status(500).json({ error: 'Failed to fetch trade history' });
    }
  });

  // GEX levels endpoint
  app.get('/api/gex/:underlying', async (req, res) => {
    try {
      const { underlying } = req.params;
      const chainData = await schwabService.getOptionsChain(underlying);
      const gexLevels = marketDataService.generateGexLevels([...chainData.calls, ...chainData.puts]);

      res.json(gexLevels);
    } catch (error) {
      console.error('❌ GEX levels error:', error);
      res.status(500).json({ error: 'Failed to calculate GEX levels' });
    }
  });

  // Market Walls endpoint
  app.get('/api/walls/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const walls = await marketDataService.getMarketWalls(symbol);
      res.json(walls);
    } catch (error) {
      console.error('❌ Market walls error:', error);
      res.status(500).json({ error: 'Failed to fetch market walls' });
    }
  });

  // Quotes endpoint
  app.get('/api/quotes', async (req, res) => {
    try {
      const symbolsStr = req.query.symbols as string;
      if (!symbolsStr) {
        res.status(400).json({ error: 'Missing symbols parameter' });
        return;
      }

      const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase());
      const quotes = await schwabService.getQuotes(symbols);
      res.json(quotes);
    } catch (error) {
      console.error('❌ Quotes error:', error);
      res.status(500).json({ error: 'Failed to fetch quotes' });
    }
  });

  // Price History endpoint
  app.get('/api/history/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { periodType, period, frequencyType, frequency } = req.query;

      const history = await schwabService.getPriceHistory(
        symbol,
        periodType as string,
        Number(period || 1),
        frequencyType as string,
        Number(frequency || 5)
      );
      res.json(history);
    } catch (error) {
      console.error('❌ Price History error:', error);
      res.status(500).json({ error: 'Failed to fetch price history' });
    }
  });

  // Catch-all for API 404
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });
}
