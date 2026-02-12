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
  drift?: number;
  gammaFlip?: number;
  maxPain?: number;
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
          bidHits: Math.max(10, Math.min(90, Math.floor(50 - (change * 5)))), // Estimate flow based on price direction
          askHits: Math.max(10, Math.min(90, Math.ceil(50 + (change * 5))))
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

  async getZeroDTEOptions(symbol: string = 'SPX'): Promise<any> {
    try {
      let searchSymbol = symbol.toUpperCase();

      // Intentar obtener la cadena de opciones
      let chain = null;

      // Si el símbolo es SPX, intentamos con $SPX primero (formato estándar para índices)
      // Optimizamos para evitar errores 502 Bad Gateway
      if (searchSymbol === 'SPX') {
        console.log('📡 Scanner: Trying $SPX index symbol first (Optimized)...');
        try {
          chain = await this.schwabService.getOptionsChain('$SPX', 30, 100);
          if (chain && (chain.callExpDateMap || chain.putExpDateMap)) {
            searchSymbol = '$SPX';
          }
        } catch (e) {
          console.warn('⚠️ Scanner: $SPX optimized call failed, will try standard');
        }
      }

      // Si no tenemos cadena aún, intentamos con el símbolo original
      if (!chain || (!chain.callExpDateMap && !chain.putExpDateMap)) {
        chain = await this.schwabService.getOptionsChain(searchSymbol, 45);
      }

      // Fallback for SPX to SPXW
      if ((!chain || (!chain.callExpDateMap && !chain.putExpDateMap)) && searchSymbol.includes('SPX')) {
        console.log('⚠️ Scanner: SPX Chain unavailable, trying SPXW (Optimized)...');
        chain = await this.schwabService.getOptionsChain('SPXW', 30, 100);
        if (chain && (chain.callExpDateMap || chain.putExpDateMap)) searchSymbol = 'SPXW';
      }

      if (!chain || (!chain.calls && !chain.puts && !chain.callExpDateMap && !chain.putExpDateMap)) {
        console.log(`⚠️ No options chain data available for ${symbol} after multiple attempts`);
        return { options: [], stats: null };
      }

      // Schwab Chain structure usually groups by ExpDate
      // Get 'YYYY-MM-DD' in local time
      const today = new Date().toLocaleDateString('en-CA');
      console.log(`📅 filtering 0DTE for date: ${today}`);

      // Flatten calls and puts (Handle both Real API Maps and Mock Arrays)
      const allOptions: any[] = [];

      if (chain.callExpDateMap) {
        Object.values(chain.callExpDateMap).forEach((expirationMap: any) => {
          Object.values(expirationMap).forEach((strikesArray: any) => {
            allOptions.push(...strikesArray);
          });
        });
      } else if (chain.calls) {
        allOptions.push(...chain.calls);
      }

      if (chain.putExpDateMap) {
        Object.values(chain.putExpDateMap).forEach((expirationMap: any) => {
          Object.values(expirationMap).forEach((strikesArray: any) => {
            allOptions.push(...strikesArray);
          });
        });
      } else if (chain.puts) {
        allOptions.push(...chain.puts);
      }

      // Robust price detection
      const currentPrice = chain.underlying?.last ||
        chain.underlying?.lastPrice ||
        chain.underlyingPrice ||
        (allOptions.length > 0 ? parseFloat(allOptions[0].strikePrice || allOptions[0].strike) : 0);

      // Extract all available expirations
      const availableDates = new Set<string>();
      allOptions.forEach((opt: any) => {
        if (opt.expirationDate) availableDates.add(opt.expirationDate);
      });

      // Determine target date: Today OR Next Available
      let targetDate = today;
      const sortedDates = Array.from(availableDates).sort();

      // Robust Date Selection:
      // We want the EARLIEST expiration that is >= today
      const futureDates = sortedDates.filter(d => d.split('T')[0] >= today);

      if (futureDates.length > 0) {
        targetDate = futureDates[0].split('T')[0];
      } else if (sortedDates.length > 0) {
        targetDate = sortedDates[0].split('T')[0];
      }

      // Calculate TTE (Time to Expiration) based on the actual target expiration date
      const targetDateObj = new Date(targetDate);
      targetDateObj.setHours(16, 0, 0, 0); // Expiration at 4 PM ET

      const now = new Date();
      let tReal = (targetDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);

      // If we are on expiration day and past close, or same day, ensure a minimum T to avoid BS model breakdown
      if (tReal <= 0) tReal = 1 / (365 * 24); // 1 hour minimum if we're on the edge

      // 1. Calculate GLOBAL Walls using ALL options (to match HUD)
      const globalStrikeMetrics = new Map<number, { callGex: number; putGex: number }>();
      let globalMaxCallGex = 0;
      let globalMaxPutGex = 0;
      let globalCallWallStrike = 0;
      let globalPutWallStrike = 0;

      allOptions.forEach((opt: any) => {
        const strike = parseFloat(opt.strikePrice || opt.strike);
        const oi = opt.openInterest || 0;
        const gamma = opt.gamma || 0;
        const isCall = opt.putCall === 'CALL';

        if (!globalStrikeMetrics.has(strike)) {
          globalStrikeMetrics.set(strike, { callGex: 0, putGex: 0 });
        }
        const metrics = globalStrikeMetrics.get(strike)!;
        // Normalized GEX = Gamma * OI * 100 * (Spot^2) * 0.01 (QuantData Standard)
        const gexContribution = gamma * oi * 100 * (currentPrice * currentPrice) * 0.01;

        if (isCall) {
          metrics.callGex += gexContribution;
          if (metrics.callGex > globalMaxCallGex) {
            globalMaxCallGex = metrics.callGex;
            globalCallWallStrike = strike;
          }
        } else {
          metrics.putGex -= gexContribution;
          if (metrics.putGex < globalMaxPutGex) {
            globalMaxPutGex = metrics.putGex;
            globalPutWallStrike = strike;
          }
        }
      });

      const strikes = new Map<number, {
        callOi: number; putOi: number; // INTERÉS ABIERTO TOTAL (Global)
        callGex: number; putGex: number; // MÉTRICAS 0DTE (Específicas)
        callVanna: number; putVanna: number;
        callDex: number; putDex: number;
      }>();

      // 1. Accumulate Global Open Interest for all strikes first
      allOptions.forEach((opt: any) => {
        const strike = parseFloat(opt.strikePrice || opt.strike);
        const oi = opt.openInterest || 0;
        const isCall = opt.putCall === 'CALL';

        if (!strikes.has(strike)) strikes.set(strike, {
          callOi: 0, putOi: 0,
          callGex: 0, putGex: 0,
          callVanna: 0, putVanna: 0,
          callDex: 0, putDex: 0
        });

        const stat = strikes.get(strike)!;
        if (isCall) stat.callOi += oi;
        else stat.putOi += oi;
      });

      // 2. Calculate 0DTE specific GEX, Vanna & DEX for the chart and list
      allOptions.forEach((opt: any) => {
        // Filter by our smart target date for the detailed stats
        if (!opt.expirationDate?.startsWith(targetDate)) return;

        const strike = parseFloat(opt.strikePrice || opt.strike);
        const oi = opt.openInterest || 0;
        const gammaFromAPI = opt.gamma || 0;
        const volatility = (opt.volatility || 20) / 100;

        // Recalcular Gamma si es 0DTE para mayor precisión, usando Black-Scholes
        let gamma = gammaFromAPI;
        if (tReal > 0 && tReal < 1 / 365) {
          gamma = this.calculateBSGamma(currentPrice, strike, volatility, tReal);
        }

        const vega = opt.vega || 0;
        const delta = opt.delta || 0;
        const stat = strikes.get(strike)!;

        // Normalized GEX = Gamma * OI * 100 * (Spot^2) * 0.01
        const gexValue = gamma * oi * 100 * (currentPrice * currentPrice) * 0.01;

        // Vanna Exposure = Vega * OI * 100 (Simplified institutional exposure)
        const vannaValue = vega * oi * 100;

        // Delta Exposure = Delta * OI * 100
        const dexValue = delta * oi * 100;

        if (opt.putCall === 'CALL') {
          stat.callGex += gexValue;
          stat.callVanna += vannaValue;
          stat.callDex += dexValue;
        } else {
          stat.putGex -= gexValue;
          stat.putVanna -= vannaValue;
          stat.putDex += dexValue;
        }
      });

      // Calculate Vanna Exposure (Net Delta Change per 1% IV Drop)
      // Dealer Short Call: IV Drop -> Delta less negative -> Buy Underlying (+ Effect)
      // Dealer Short Put:  IV Drop -> Delta less positive -> Sell Underlying (- Effect)
      // Formula: Vanna ~ Σ(CallVega * OI) - Σ(PutVega * OI)
      let vannaExposure = 0;
      allOptions.forEach((opt: any) => {
        if (!opt.expirationDate?.startsWith(targetDate)) return;

        const oi = opt.openInterest || 0;
        const vega = opt.vega || 0;

        if (opt.putCall === 'CALL') {
          vannaExposure += (vega * oi);
        } else {
          vannaExposure -= (vega * oi);
        }
      });

      const zeroDte = allOptions.filter((opt: any) =>
        opt.expirationDate && opt.expirationDate.startsWith(targetDate)
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
          callVanna: data.callVanna,
          putVanna: data.putVanna,
          callDex: data.callDex,
          putDex: data.putDex,
          callOi: data.callOi,
          putOi: data.putOi
        }))
        .sort((a, b) => a.strike - b.strike);

      const changePercent = chain.underlying?.percentChange || chain.underlying?.changePercent || chain.underlying?.netPercentChange || 0;

      // Calculate Delta Target logic
      // 1. Get IV (Implied Volatility) - Estimate from ATM Option
      let volatilityImplied = 0;

      if (allOptions.length > 0) {
        const atmOption = allOptions.reduce((prev: any, curr: any) => {
          const prevDiff = Math.abs(parseFloat(prev.strikePrice || prev.strike) - currentPrice);
          const currDiff = Math.abs(parseFloat(curr.strikePrice || curr.strike) - currentPrice);
          return currDiff < prevDiff ? curr : prev;
        }, allOptions[0]);

        if (atmOption) {
          volatilityImplied = atmOption.volatility || 0;
        }
      }

      // 2. Apply Dynamic Delta Logic
      let deltaTarget = 0.20;  // Default

      if (volatilityImplied > 25) {
        deltaTarget = 0.25;  // IV alta -> vender más OTM
      }

      if (volatilityImplied < 12) {
        deltaTarget = 0.15;  // IV baja -> vender más cercano
      }

      if (Math.abs(changePercent) > 0.7) {
        deltaTarget = 0.20;  // Drift fuerte -> mantener conservador
      }

      return {
        options: topOptions,
        stats: {
          callWall: globalCallWallStrike,
          putWall: globalPutWallStrike,
          currentPrice,
          strikes: strikesArray,
          targetDate, // Send back which date we used
          deltaTarget, // Add calculated target
          volatilityImplied, // Add for reference
          drift: changePercent, // Add for reference
          vannaExposure, // Net Vanna
          fetchedSymbol: searchSymbol,
          gammaFlip: this.calculateGammaFlip(zeroDte, currentPrice, tReal),
          maxPain: this.calculateMaxPain(zeroDte),
          pinningTarget: this.calculatePinningTarget(globalCallWallStrike, globalPutWallStrike, this.calculateMaxPain(zeroDte), currentPrice, changePercent),
          ivRank: await this.calculateIVRank(symbol, volatilityImplied)
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

  private calculateBSGamma(S: number, K: number, sigma: number, T: number): number {
    if (T <= 0 || sigma <= 0 || S <= 0) return 0;
    try {
      const d1 = (Math.log(S / K) + (0.04 + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
      const nPrimeD1 = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * d1 * d1);
      return nPrimeD1 / (S * sigma * Math.sqrt(T));
    } catch (e) {
      return 0;
    }
  }

  async getMarketWalls(symbol: string) {
    try {
      const chain = await this.schwabService.getOptionsChain(symbol);

      if (!chain || (!chain.calls && !chain.puts && !chain.callExpDateMap)) {
        return { callWall: 0, putWall: 0 };
      }

      const allCalls: any[] = [];
      const allPuts: any[] = [];

      // Extract calls
      if (chain.callExpDateMap) {
        Object.values(chain.callExpDateMap).forEach((expMap: any) => {
          Object.values(expMap).forEach((strikeArr: any) => allCalls.push(...strikeArr));
        });
      } else if (chain.calls) {
        allCalls.push(...chain.calls);
      }

      // Extract puts
      if (chain.putExpDateMap) {
        Object.values(chain.putExpDateMap).forEach((expMap: any) => {
          Object.values(expMap).forEach((strikeArr: any) => allPuts.push(...strikeArr));
        });
      } else if (chain.puts) {
        allPuts.push(...chain.puts);
      }

      let callWall = { strike: 0, oi: 0 };
      let putWall = { strike: 0, oi: 0 };

      // Find Call Wall (Max OI)
      allCalls.forEach((opt: any) => {
        const strike = parseFloat(opt.strikePrice || opt.strike);
        const oi = opt.openInterest || 0;
        if (oi > callWall.oi) {
          callWall = { strike, oi };
        }
      });

      // Find Put Wall (Max OI)
      allPuts.forEach((opt: any) => {
        const strike = parseFloat(opt.strikePrice || opt.strike);
        const oi = opt.openInterest || 0;
        if (oi > putWall.oi) {
          putWall = { strike, oi };
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

  private calculateGammaFlip(options: any[], currentPrice: number, tReal: number): number {
    try {
      const range = 0.08;
      const steps = 120;   // Resolución equilibrada
      const startPrice = currentPrice * (1 - range);
      const stepSize = (currentPrice * range * 2) / steps;

      const profile: Array<{ price: number, netGex: number }> = [];

      // Usar un T mínimo para suavizar el perfil visual y evitar picos infinitos ATM
      const visualT = Math.max(tReal, 1 / 365);

      for (let i = 0; i <= steps; i++) {
        const simulatedPrice = startPrice + i * stepSize;
        let totalNetGex = 0;

        for (const opt of options) {
          const strike = parseFloat(opt.strikePrice || opt.strike);
          const oi = opt.openInterest || 0;
          const volatility = (opt.volatility || 20) / 100;
          const isCall = opt.putCall === 'CALL';

          const gamma = this.calculateBSGamma(simulatedPrice, strike, volatility, visualT);
          // Normalized GEX = Gamma * OI * 100 * (S^2) * 0.01
          const gex = gamma * oi * 100 * (simulatedPrice * simulatedPrice) * 0.01;

          if (isCall) totalNetGex += gex;
          else totalNetGex -= gex;
        }

        profile.push({ price: simulatedPrice, netGex: totalNetGex });
      }

      // Interpolate for zero crossing - Find the one closest to current price
      let gammaFlip = currentPrice;
      let minDistance = Infinity;
      for (let i = 0; i < profile.length - 1; i++) {
        const p1 = profile[i];
        const p2 = profile[i + 1];
        if (p1.netGex * p2.netGex <= 0) {
          const weight = Math.abs(p1.netGex) / (Math.abs(p1.netGex) + Math.abs(p2.netGex));
          const crossingPrice = p1.price + weight * (p2.price - p1.price);
          const distance = Math.abs(crossingPrice - currentPrice);

          if (distance < minDistance) {
            minDistance = distance;
            gammaFlip = crossingPrice;
          }
        }
      }
      return gammaFlip;
    } catch (e) {
      console.error('Error calculating Gamma Flip in MarketDataService', e);
      return currentPrice;
    }
  }

  /**
   * Calcula el strike de Max Pain para un conjunto de opciones
   */
  private calculateMaxPain(options: any[]): number {
    try {
      if (!options || options.length === 0) return 0;

      // 1. Strikes únicos
      const strikes = [...new Set(options.map(o => parseFloat(o.strikePrice || o.strike)))]
        .filter(s => !isNaN(s) && s > 0)
        .sort((a, b) => a - b);

      if (strikes.length === 0) return 0;

      let minPain = Infinity;
      let maxPainStrike = strikes[0];

      // 2. Probar cada strike
      for (const testPrice of strikes) {
        let totalPain = 0;
        for (const opt of options) {
          const strike = parseFloat(opt.strikePrice || opt.strike);
          // Usamos OI + Volumen para detectar cambios intradiarios (Live Max Pain)
          // Schwab usa 'volume' para opciones y 'totalVolume' para acciones, soportamos ambos
          const liquidity = (opt.openInterest || 0) + (opt.totalVolume || opt.volume || 0);
          if (liquidity <= 0) continue;

          if (opt.putCall === 'CALL') {
            if (testPrice > strike) totalPain += (testPrice - strike) * liquidity;
          } else {
            if (testPrice < strike) totalPain += (strike - testPrice) * liquidity;
          }
        }

        if (totalPain < minPain) {
          minPain = totalPain;
          maxPainStrike = testPrice;
        }
      }

      return maxPainStrike;
    } catch (e) {
      console.error('Error calculating Max Pain in MarketDataService', e);
      return 0;
    }
  }

  /**
   * Calcula el objetivo de anclaje (pinning) basado en walls y Max Pain
   */
  private calculatePinningTarget(callWall: number, putWall: number, maxPain: number, currentPrice: number, drift: number): number {
    try {
      // 1. Convergencia de Muros
      if (callWall === putWall) return callWall;

      // 2. Si Max Pain está alineado con uno de los muros, ese es el imán fuerte
      const isMaxPainNearCall = Math.abs(maxPain - callWall) / callWall < 0.002;
      const isMaxPainNearPut = Math.abs(maxPain - putWall) / putWall < 0.002;

      if (isMaxPainNearCall) return callWall;
      if (isMaxPainNearPut) return putWall;

      // 3. Si no hay coincidencia, elegir el muro más cercano al precio actual
      // pero si el drift es muy fuerte, elegir el muro en dirección del drift
      if (Math.abs(drift) > 1.5) {
        return drift > 0 ? callWall : putWall;
      }

      return Math.abs(currentPrice - callWall) < Math.abs(currentPrice - putWall) ? callWall : putWall;
    } catch (e) {
      return callWall;
    }
  }

  /**
   * Calcula el IV Rank basado en histórico de 1 año (252 días)
   */
  private async calculateIVRank(symbol: string, currentIV: number): Promise<number> {
    try {
      // 1. Determinar símbolo proxy para volatilidad
      let vSymbol = '$VIX'; // Default para SPX/SPY
      if (symbol.includes('QQQ')) vSymbol = '$VIXN';
      if (symbol.includes('IWM')) vSymbol = '$RVX';

      // 2. Intentar obtener histórico de 1 año
      const history = await this.schwabService.getPriceHistory(vSymbol, 'year', 1, 'daily', 1);

      if (!history || history.length === 0) {
        // Fallback: Si no hay histórico, devolver un valor neutral basado en el IV actual
        return currentIV > 25 ? 65 : 35;
      }

      const ivs = history.map(c => c.close);
      const high = Math.max(...ivs);
      const low = Math.min(...ivs);

      // Si el símbolo actual es el VIX, usamos su precio. Si no, usamos el IV que nos pasaron.
      const currentVal = (symbol.includes('SPX') || symbol.includes('SPY')) ? (await this.schwabService.getQuotes(['$VIX']))['$VIX']?.quote?.lastPrice || currentIV : currentIV;

      if (high === low) return 50;

      const rank = ((currentVal - low) / (high - low)) * 100;
      return Math.max(0, Math.min(100, rank));
    } catch (error) {
      console.error('❌ Error calculating IV Rank:', error);
      return 50;
    }
  }
}
