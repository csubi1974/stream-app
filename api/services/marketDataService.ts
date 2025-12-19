import { createClient } from 'redis';
import { SchwabService } from './schwabService.js';
import { mockDb } from '../database/mock.js';

export interface VolumeData {
  symbol: string;
  rvol: number;
  dollarVolume: number;
  price: number;
  changePercent: number;
  action: string;
  bidHits: number;
  askHits: number;
}

export class MarketDataService {
  private redis: ReturnType<typeof createClient>;
  private schwabService: SchwabService;

  constructor(schwabService: SchwabService) {
    this.redis = createClient({ url: process.env.REDIS_URL });
    this.schwabService = schwabService;
    this.initializeRedis();
  }

  private memoryCache = new Map<string, { value: any, expires: number }>();

  private async initializeRedis() {
    try {
      await this.redis.connect();
      console.log('✅ Redis connected');
    } catch (error) {
      console.error('❌ Redis connection failed, using in-memory fallback:', error);
    }
  }

  async getVolumeScanner(minRvol: number = 3, minDollarVolume: number = 50_000_000): Promise<VolumeData[]> {
    // Universe of stocks to scan (Approximation for Scanner)
    const universe = [
      // Indices & ETFs
      'SPY', 'QQQ', 'IWM', 'DIA', 'TQQQ', 'SQQQ', 'SMH', 'XLK', 'XLF', 'UVXY',
      // Mag 7 & Big Tech
      'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NFLX',
      // Semis & AI
      'AMD', 'SMCI', 'AVGO', 'MU', 'INTC', 'ARM', 'TSM', 'ORCL',
      // High Volatility / Crypto / Growth
      'MSTR', 'COIN', 'PLTR', 'HOOD', 'DKNG', 'ROKU', 'SQ', 'SHOP', 'UBER', 'DASH', 'CVNA',
      // Financials & Industrial
      'JPM', 'BAC', 'GS', 'CAT', 'DE', 'BA',
      // Pharma & Retail
      'LLY', 'NVO', 'WMT', 'COST', 'TGT',
      // China / Global
      'BABA', 'PDD'
    ];

    try {
      console.log('🔍 Scanner universe:', universe);
      const quotes = await this.schwabService.getQuotes(universe);
      console.log('📦 Schwab Quotes response keys:', Object.keys(quotes || {}));

      const results: VolumeData[] = [];

      for (const symbol of universe) {
        if (!quotes[symbol]) {
          console.warn(`⚠️ No quote data for ${symbol}`);
          continue;
        }

        const q = quotes[symbol].quote;
        const f = quotes[symbol].fundamental; // Need fundamental for avg volume if available

        if (!q) {
          console.warn(`⚠️ Missing quote sub-object for ${symbol}`);
          continue;
        }

        const totalVol = q.totalVolume || 0;
        const lastPrice = q.lastPrice || 0;
        const dollarVol = totalVol * lastPrice;

        // RVOL calc approximation (Volume / (AvgVolume / 6.5 * CurrentTimeFraction)?)
        // For now using pure ratio if AvgVol exists
        let rvol = 0;
        if (f && f.avg10DaysVolume) {
          rvol = totalVol / f.avg10DaysVolume;
        }

        const change = q.netPercentChange || 0;

        // Determine action based on simple logic
        let action = 'Waiting';
        if (Math.abs(change) > 2) action = change > 0 ? '🟢 Breakout' : '🔴 Breakdown';
        else if (rvol > 2) action = '⚠️ High Vol';

        results.push({
          symbol,
          rvol: Number(rvol.toFixed(2)),
          dollarVolume: dollarVol,
          price: lastPrice,
          changePercent: change,
          action,
          bidHits: 50, // Real-time streaming aggr needed for this, keeping static for now
          askHits: 50
        });
      }

      console.log(`✅ Scanner processed ${results.length} items`);
      return results
        .filter(s => s.dollarVolume >= minDollarVolume) // Basic filtering
        .sort((a, b) => b.rvol - a.rvol); // Sort by Relative Volume

    } catch (error) {
      console.error('Failed to get scanner data, returning empty', error);
      return [];
    }
  }

  async getZeroDTEOptions(): Promise<any> {
    try {
      // Fetch SPX Option Chain
      const chain = await this.schwabService.getOptionsChain('SPX');

      if (!chain || (!chain.calls && !chain.puts)) return { options: [], stats: null };

      // Schwab Chain structure usually groups by ExpDate
      // Get 'YYYY-MM-DD' in local time
      const today = new Date().toLocaleDateString('en-CA');
      console.log(`📅 filtering 0DTE for date: ${today}`);

      // Flatten calls and puts
      const allOptions = [
        ...(chain.calls || []),
        ...(chain.puts || [])
      ];

      // Calculate Walls & GEX
      const strikes = new Map<number, { callOi: number; putOi: number; callGex: number; putGex: number }>();

      let callWall = { strike: 0, oi: 0 };
      let putWall = { strike: 0, oi: 0 };
      const currentPrice = chain.underlying?.last || 0;

      allOptions.forEach((opt: any) => {
        if (!opt.expirationDate?.startsWith(today)) return;

        const strike = parseFloat(opt.strikePrice || opt.strike);
        const oi = opt.openInterest || 0;
        const gamma = opt.gamma || 0;

        if (!strikes.has(strike)) strikes.set(strike, { callOi: 0, putOi: 0, callGex: 0, putGex: 0 });
        const stat = strikes.get(strike)!;

        // GEX = Gamma * OI * 100 * Spot Price
        // Using 1 for Price factor if Spot not strictly available per-option, but we have currentPrice
        const gexValue = gamma * oi * 100 * (currentPrice || strike);

        if (opt.putCall === 'CALL') {
          stat.callOi += oi;
          stat.callGex += gexValue;
          if (stat.callOi > callWall.oi) callWall = { strike, oi: stat.callOi };
        } else {
          stat.putOi += oi;
          stat.putGex -= gexValue; // Negative GEX for Puts for visualization
          if (stat.putOi > putWall.oi) putWall = { strike, oi: stat.putOi };
        }
      });

      const zeroDte = allOptions.filter((opt: any) =>
        opt.expirationDate && opt.expirationDate.startsWith(today)
      );

      const topOptions = zeroDte
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .filter(o => o.volume > 100)
        .slice(0, 50);

      // Convert strikes Map to Array for frontend
      const strikesArray = Array.from(strikes.entries())
        .map(([strike, data]) => ({
          strike,
          callGex: data.callGex,
          putGex: data.putGex,
          callOi: data.callOi,
          putOi: data.putOi
        }))
        .sort((a, b) => a.strike - b.strike);

      return {
        options: topOptions,
        stats: {
          callWall: callWall.strike,
          putWall: putWall.strike,
          currentPrice,
          strikes: strikesArray
        }
      };

    } catch (error) {
      console.error('Failed to get 0DTE options', error);
      return { options: [], stats: null };
    }
  }

  async cacheMarketData(key: string, data: any, ttl: number = 300) {
    if (!this.redis.isOpen) {
      this.memoryCache.set(key, {
        value: data,
        expires: Date.now() + (ttl * 1000)
      });
      return;
    }

    try {
      await this.redis.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('❌ Redis cache error, falling back to memory:', error);
      this.memoryCache.set(key, {
        value: data,
        expires: Date.now() + (ttl * 1000)
      });
    }
  }

  async getCachedData(key: string): Promise<any | null> {
    if (!this.redis.isOpen) {
      const cached = this.memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }
      if (cached) this.memoryCache.delete(key);
      return null;
    }

    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      // Handle both string and Buffer cases
      const dataStr = typeof data === 'string' ? data : data.toString();
      return JSON.parse(dataStr);
    } catch (error) {
      console.error('❌ Redis get error, falling back to memory:', error);
      const cached = this.memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }
      return null;
    }
  }

  async saveTradeToHistory(trade: any) {
    return mockDb.recordTrade(trade.symbol, trade.price, trade.size, trade.side, trade.exchange);
  }

  async getTradeHistory(symbol: string, limit: number = 100): Promise<any[]> {
    return mockDb.getTradeHistory(symbol, limit);
  }

  async getMarketWalls(symbol: string) {
    try {
      const chain = await this.schwabService.getOptionsChain(symbol);

      if (!chain || (!chain.calls && !chain.puts)) {
        return { callWall: 0, putWall: 0 };
      }

      let callWall = { strike: 0, oi: 0 };
      let putWall = { strike: 0, oi: 0 };

      // Find Call Wall (Max OI)
      (chain.calls || []).forEach((opt: any) => {
        if ((opt.openInterest || 0) > callWall.oi) {
          callWall = { strike: Number(opt.strike), oi: opt.openInterest };
        }
      });

      // Find Put Wall (Max OI)
      (chain.puts || []).forEach((opt: any) => {
        if ((opt.openInterest || 0) > putWall.oi) {
          putWall = { strike: Number(opt.strike), oi: opt.openInterest };
        }
      });

      return {
        symbol,
        callWall: callWall.strike,
        putWall: putWall.strike,
        callWallOI: callWall.oi,
        putWallOI: putWall.oi
      };

    } catch (error) {
      console.error(`Failed to calculate walls for ${symbol}`, error);
      return { callWall: 0, putWall: 0 };
    }
  }

  generateGexLevels(optionsData: any[]): { callWall: number; putWall: number } {
    // Calcular niveles GEX simplificados basados en gamma y OI
    const callGamma = optionsData
      .filter(opt => opt.type === 'CALL')
      .reduce((sum, opt) => sum + (opt.gamma * opt.openInterest), 0);

    const putGamma = optionsData
      .filter(opt => opt.type === 'PUT')
      .reduce((sum, opt) => sum + (opt.gamma * opt.openInterest), 0);

    return {
      callWall: 6950, // Simplificado - en producción usar cálculo complejo
      putWall: 6850
    };
  }
}
