import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface OptionsBookData {
  symbol: string;
  bids: Array<{ price: number; size: number; exchange: string }>;
  asks: Array<{ price: number; size: number; exchange: string }>;
  last: { price: number; size: number; time: string };
}

interface TradeData {
  symbol: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  exchange: string;
  timestamp: string;
}

export class SchwabService {
  private baseURL = process.env.SCHWAB_API_BASE || 'https://api.schwabapi.com';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private authorizeURL = process.env.SCHWAB_AUTHORIZE_URL || 'https://api.schwabapi.com/oauth2/authorize';
  private tokenURL = process.env.SCHWAB_TOKEN_URL || 'https://api.schwabapi.com/oauth2/token';
  private bookEndpoint = process.env.SCHWAB_ENDPOINT_BOOK || '/marketdata/v1/options/book';
  private chainEndpoint = process.env.SCHWAB_ENDPOINT_CHAIN || '/marketdata/v1/chains';
  private timeSalesEndpoint = process.env.SCHWAB_ENDPOINT_TIMESALES || '/marketdata/v1/options/timesales';
  private quotesEndpoint = process.env.SCHWAB_ENDPOINT_QUOTES || '/marketdata/v1/quotes';
  private tokensPath = path.join(process.cwd(), 'tokens.json');

  constructor() {
    this.initializeAuth();
    this.watchTokensFile();
  }

  private watchTokensFile() {
    if (fs.existsSync(this.tokensPath)) {
      fs.watchFile(this.tokensPath, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log('🔄 tokens.json changed, reloading...');
          this.loadTokens();
        }
      });
    }
  }

  private async initializeAuth() {
    const appKey = process.env.SCHWAB_APP_KEY;
    const secret = process.env.SCHWAB_SECRET;
    const redirectUri = process.env.SCHWAB_REDIRECT_URI;

    if (!appKey || !secret || !redirectUri) {
      console.warn('⚠️ Schwab API credentials not configured');
      return;
    }

    this.loadTokens();
  }

  private loadTokens() {
    try {
      if (fs.existsSync(this.tokensPath)) {
        // Read file directly to avoid caching issues
        const fileContent = fs.readFileSync(this.tokensPath, 'utf-8');
        const tokens = JSON.parse(fileContent);
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        console.log('✅ Schwab tokens loaded from disk');
      }
    } catch (error) {
      console.error('❌ Failed to load tokens:', error);
    }
  }

  private saveTokens() {
    try {
      // Temporarily unwatch to avoid triggering reload loop
      fs.unwatchFile(this.tokensPath);

      fs.writeFileSync(this.tokensPath, JSON.stringify({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken
      }, null, 2));
      console.log('💾 Schwab tokens saved to disk');

      // Re-watch
      this.watchTokensFile();
    } catch (error) {
      console.error('❌ Failed to save tokens:', error);
    }
  }

  private async apiGet(path: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    try {
      const url = `${this.baseURL}${path}`;
      console.log(`📡 GET ${url}`, params);
      const res = await axios.get(url, {
        params,
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });
      return res.data;
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await this.refreshAccessToken();
        const res2 = await axios.get(`${this.baseURL}${path}`, {
          params,
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        });
        return res2.data;
      }
      throw error;
    }
  }

  getAuthUrl(): string {
    const appKey = process.env.SCHWAB_APP_KEY;
    const redirectUri = process.env.SCHWAB_REDIRECT_URI;
    const state = Math.random().toString(36).slice(2);
    const scope = 'read';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: appKey || '',
      redirect_uri: redirectUri || '',
      scope,
      state
    });
    return `${this.authorizeURL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<void> {
    const appKey = process.env.SCHWAB_APP_KEY;
    const secret = process.env.SCHWAB_SECRET;
    const redirectUri = process.env.SCHWAB_REDIRECT_URI;

    // Basic Auth Header
    const authHeader = 'Basic ' + Buffer.from(`${appKey}:${secret}`).toString('base64');

    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || ''
    });

    try {
      const res = await axios.post(this.tokenURL, payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        }
      });
      this.accessToken = res.data.access_token || null;
      this.refreshToken = res.data.refresh_token || null;
      this.saveTokens();
      console.log('✅ Schwab auth successful, token received');
    } catch (error: any) {
      if (error.response) {
        console.error('❌ Schwab token exchange failed:', error.response.status, error.response.data);
      } else {
        console.error('❌ Schwab token exchange error:', error.message);
      }
      throw error;
    }
  }

  async setTokens(access: string, refresh?: string): Promise<void> {
    this.accessToken = access || null;
    this.refreshToken = refresh || null;
    this.saveTokens();
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) return;
    const appKey = process.env.SCHWAB_APP_KEY;
    const secret = process.env.SCHWAB_SECRET;

    const authHeader = 'Basic ' + Buffer.from(`${appKey}:${secret}`).toString('base64');

    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken || ''
    });

    try {
      const res = await axios.post(this.tokenURL, payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        }
      });
      this.accessToken = res.data.access_token || null;
      this.refreshToken = res.data.refresh_token || this.refreshToken;
      this.saveTokens();
    } catch (error) {
      console.error('❌ Refresh token failed:', error);
    }
  }

  async getOptionsBook(symbol: string, levels: number = 10): Promise<OptionsBookData> {
    if (!this.accessToken) {
      console.warn(`⚠️ No access token available for getOptionsBook(${symbol})`);
      return {
        symbol,
        bids: [],
        asks: [],
        last: { price: 0, size: 0, time: new Date().toISOString() }
      };
    }

    try {
      const data = await this.apiGet(this.bookEndpoint, { symbol, levels });
      const last = data.last || data.lastTrade || { price: 0, size: 0, time: new Date().toISOString() };
      return {
        symbol,
        bids: data.bids?.map((b: any) => ({ price: Number(b.price), size: Number(b.size || b.quantity || 0), exchange: String(b.exchange || '') })) || [],
        asks: data.asks?.map((a: any) => ({ price: Number(a.price), size: Number(a.size || a.quantity || 0), exchange: String(a.exchange || '') })) || [],
        last: { price: Number(last.price || 0), size: Number(last.size || 0), time: String(last.time || new Date().toISOString()) }
      };
    } catch (error) {
      console.error(`❌ Failed to fetch Options Book for ${symbol}:`, error);
      return {
        symbol,
        bids: [],
        asks: [],
        last: { price: 0, size: 0, time: new Date().toISOString() }
      };
    }
  }

  async getOptionsChain(underlying: string): Promise<any> {
    if (!this.accessToken) {
      console.warn(`⚠️ No access token available for getOptionsChain(${underlying})`);
      return null;
    }

    try {
      const data = await this.apiGet(this.chainEndpoint, { symbol: underlying });
      return data;
    } catch (error) {
      console.error(`❌ Failed to fetch real Options Chain for ${underlying}`, error);
      return null;
    }
  }

  async getTimeAndSales(symbol: string): Promise<TradeData[]> {
    if (!this.accessToken) {
      console.warn(`⚠️ No access token available for getTimeAndSales(${symbol})`);
      return [];
    }

    try {
      const data = await this.apiGet(this.timeSalesEndpoint, { symbol });
      return (data?.trades || data || []).map((t: any) => ({
        symbol,
        price: Number(t.price),
        size: Number(t.size || t.quantity || 0),
        side: (String(t.side || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY'),
        exchange: String(t.exchange || ''),
        timestamp: String(t.timestamp || t.time || new Date().toISOString())
      }));
    } catch (error) {
      console.error(`❌ Failed to fetch Time & Sales for ${symbol}:`, error);
      return [];
    }
  }

  async detectSweeps(symbol: string): Promise<TradeData[]> {
    const trades = await this.getTimeAndSales(symbol);
    return trades.filter(trade => trade.size >= 50); // Sweeps > 50 contratos
  }

  async getQuotes(symbols: string[]): Promise<any> {
    if (this.accessToken) {
      const data = await this.apiGet(this.quotesEndpoint, { symbols: symbols.join(','), fields: 'quote,fundamental' });
      return data;
    }
    return {};
  }

  isConnected(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Get market news headlines
   */
  async getMarketNews(symbol?: string, limit: number = 20): Promise<any[]> {
    try {
      const endpoint = symbol
        ? `/marketdata/v1/${symbol}/news`
        : `/marketdata/v1/news`;

      const response = await this.apiGet(endpoint, { maxResults: limit });
      return response || [];
    } catch (error) {
      console.error('❌ Failed to fetch market news:', error);
      return [];
    }
  }

  async getPriceHistory(symbol: string, periodType: string = 'day', period: number = 1, frequencyType: string = 'minute', frequency: number = 5): Promise<any[]> {
    const endpoint = '/marketdata/v1/pricehistory';

    if (!this.accessToken) {
      console.warn(`⚠️ No access token available for getPriceHistory(${symbol})`);
      return [];
    }

    try {
      const params = {
        symbol,
        periodType,
        period,
        frequencyType,
        frequency,
        needExtendedHoursData: true
      };
      const data = await this.apiGet(endpoint, params);

      if (data && data.candles) {
        return data.candles.map((c: any) => ({
          time: Math.floor(c.datetime / 1000), // Epoch seconds
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        }));
      }
    } catch (error) {
      console.error(`❌ Failed to fetch Price History for ${symbol}:`, error);
    }

    return [];
  }
}
