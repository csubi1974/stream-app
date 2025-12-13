import { WebSocketServer, WebSocket } from 'ws';
import { MarketDataService } from '../services/marketDataService.js';
import { SchwabService } from '../services/schwabService.js';

interface ClientConnection {
  ws: WebSocket;
  subscriptions: Set<string>;
  userId?: string;
}

export class WebSocketHandler {
  private clients: Map<string, ClientConnection> = new Map();
  private marketDataService: MarketDataService;
  private schwabService: SchwabService;
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor(
    private wss: WebSocketServer,
    marketDataService: MarketDataService
  ) {
    this.marketDataService = marketDataService;
    this.schwabService = new SchwabService();
  }

  initialize() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const connection: ClientConnection = {
        ws,
        subscriptions: new Set()
      };

      this.clients.set(clientId, connection);
      console.log(`🔌 Client connected: ${clientId}`);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`👋 Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.clients.delete(clientId);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Tape Reading Platform',
        clientId
      }));
    });

    // Start broadcasting market data
    this.startMarketDataBroadcast();
  }

  private async handleMessage(clientId: string, message: any) {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    switch (message.type) {
      case 'subscribe':
        await this.handleSubscribe(clientId, message.symbols);
        break;
      case 'unsubscribe':
        await this.handleUnsubscribe(clientId, message.symbols);
        break;
      case 'get_options_book':
        await this.handleGetOptionsBook(clientId, message.symbol);
        break;
      case 'get_time_sales':
        await this.handleGetTimeSales(clientId, message.symbol);
        break;
      case 'get_0dte_options':
        await this.handleGetZeroDTEOptions(clientId, message.underlying);
        break;
      default:
        connection.ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        }));
    }
  }

  private async handleSubscribe(clientId: string, symbols: string[]) {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    symbols.forEach(symbol => {
      connection.subscriptions.add(symbol.toUpperCase());
    });

    connection.ws.send(JSON.stringify({
      type: 'subscribed',
      symbols: Array.from(connection.subscriptions)
    }));
  }

  private async handleUnsubscribe(clientId: string, symbols: string[]) {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    symbols.forEach(symbol => {
      connection.subscriptions.delete(symbol.toUpperCase());
    });

    connection.ws.send(JSON.stringify({
      type: 'unsubscribed',
      symbols: Array.from(connection.subscriptions)
    }));
  }

  private async handleGetOptionsBook(clientId: string, symbol: string) {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    try {
      const bookData = await this.schwabService.getOptionsBook(symbol);
      connection.ws.send(JSON.stringify({
        type: 'options_book',
        symbol,
        data: bookData
      }));
    } catch (error) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to get options book for ${symbol}`
      }));
    }
  }

  private async handleGetTimeSales(clientId: string, symbol: string) {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    try {
      const trades = await this.schwabService.getTimeAndSales(symbol);
      connection.ws.send(JSON.stringify({
        type: 'time_sales',
        symbol,
        data: trades
      }));
    } catch (error) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to get time & sales for ${symbol}`
      }));
    }
  }

  private async handleGetZeroDTEOptions(clientId: string, underlying: string) {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    try {
      const options = await this.marketDataService.getZeroDTEOptions();
      connection.ws.send(JSON.stringify({
        type: '0dte_options',
        underlying,
        data: options
      }));
    } catch (error) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to get 0DTE options for ${underlying}`
      }));
    }
  }

  private startMarketDataBroadcast() {
    // Broadcast market data every 2 seconds to avoid rate limits (Schwab API is not streaming here yet)
    // For true streaming we would need Schwab Streamer implementation
    this.broadcastInterval = setInterval(async () => {
      try {
        // 1. Collect all unique symbols needed
        const uniqueSymbols = new Set<string>();
        this.clients.forEach(conn => {
          conn.subscriptions.forEach(s => uniqueSymbols.add(s));
        });

        if (uniqueSymbols.size === 0) return;

        const symbols = Array.from(uniqueSymbols);

        // 2. Fetch real quotes from Schwab
        // We use getQuotes from SchwabService
        // Note: We access schwabService via this.schwabService (created in constructor)
        // Ensure SchwabService has getQuotes public/accessible
        const quotesData = await this.schwabService.getQuotes(symbols);

        if (!quotesData) return;

        // 3. Broadcast to relevant clients
        this.clients.forEach(connection => {
          if (connection.subscriptions.size === 0) return;

          connection.subscriptions.forEach(symbol => {
            const quote = quotesData[symbol] ? quotesData[symbol].quote : null;
            if (!quote) return;

            const tradeData = {
              symbol,
              price: quote.lastPrice || 0,
              size: quote.lastSize || 0, // Quote size or volume? typically lastSize
              side: 'N/A', // Quotes don't show side of last trade strictly, assume neutral or infer
              exchange: quote.exchangeName || 'N/A',
              timestamp: new Date().toISOString(), // Or quote.quoteTime
              totalVolume: quote.totalVolume // Extra useful info
            };

            // Send real update
            if (connection.ws.readyState === WebSocket.OPEN) {
              connection.ws.send(JSON.stringify({
                type: 'option_trade', // Keep type compatible with frontend
                data: tradeData
              }));
            }
          });
        });

      } catch (error) {
        console.error('❌ Error broadcasting market data:', error);
      }
    }, 2000); // 2s interval
  }

  broadcastToAll(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(connection => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
      }
    });
  }

  broadcastToSymbol(symbol: string, message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(connection => {
      if (connection.subscriptions.has(symbol.toUpperCase()) &&
        connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
      }
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  shutdown() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.clients.forEach(connection => {
      connection.ws.close();
    });
    this.clients.clear();
  }
}
