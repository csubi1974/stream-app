import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle, Layers, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore, ZeroDTEOption } from '../../stores/marketStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Link } from 'react-router-dom';
import { GammaProfileChart } from '../charts/GammaProfileChart';
import { MarketSentimentGauge } from './MarketSentimentGauge';
import { LiveFlowTicker } from './LiveFlowTicker';
import { DealerDecisionMatrix } from './DealerDecisionMatrix';

interface ScanStats {
  callWall: number;
  putWall: number;
  pinningTarget?: number;
  totalVolume: number;
  currentPrice?: number;
  strikes: any[];
  targetDate?: string;
  deltaTarget?: number;
  volatilityImplied?: number;
  drift?: number;
  gammaFlip?: number;
  maxPain?: number;
}

export function ZeroDTEScanner() {
  const { t } = useTranslation();
  const { zeroDTEOptions, setZeroDTEOptions, selectedSymbol, setSelectedSymbol } = useMarketStore();
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'oi' | 'gamma' | 'delta'>('volume');
  const [filterType, setFilterType] = useState<'ALL' | 'CALL' | 'PUT'>('ALL');
  const [chartMode, setChartMode] = useState<'GEX' | 'VEX' | 'DEX'>('GEX');
  const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false);
  const commonSymbols = ['SPX', 'SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'AMZN', 'AVGO', 'GOOGL', 'MSFT', 'META', 'XLF'];

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

  const { isConnected, sendMessage } = useWebSocket({
    url: wsUrl,
    onConnect: () => {
      // Data request is handled in the useEffect below
    },
    onMessage: (message) => {
      if (message.type === '0dte_options') {
        let options: ZeroDTEOption[] = [];
        if (Array.isArray(message.data)) {
          options = message.data;
          setZeroDTEOptions(message.data);
        } else {
          options = message.data.options || [];
          setZeroDTEOptions(options);

          // Only update stats if we have valid ones to avoid flickering
          if (message.data.stats) {
            setStats(message.data.stats);
          }
        }

        // Auto-subscribe to top 10 options by volume for the ticker
        const topSymbols = options
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 10)
          .map(o => o.symbol);

        if (topSymbols.length > 0) {
          sendMessage({ type: 'subscribe', symbols: topSymbols });
        }
      }

      if (message.type === 'option_trade') {
        const trade = message.data;
        const state = useMarketStore.getState();

        // Add to global store for the Ticker
        state.addTrade({
          symbol: trade.symbol,
          price: trade.price,
          size: trade.size,
          side: trade.side || 'N/A',
          exchange: trade.exchange || 'N/A',
          timestamp: new Date().toLocaleTimeString()
        });

        // If it's a large trade, add to sweep alerts
        if (trade.size >= state.settings.sweepThreshold) {
          state.addSweepAlert({
            symbol: trade.symbol,
            price: trade.price,
            size: trade.size,
            side: trade.side || 'N/A',
            exchange: trade.exchange || 'N/A',
            timestamp: new Date().toISOString()
          });
        }

        // Update current price if it's the underlying
        const currentSymbol = (selectedSymbol || 'SPX') === 'SPX' ? '$SPX' : (selectedSymbol || 'SPX');
        if (trade.symbol === currentSymbol || trade.symbol === (selectedSymbol || 'SPX')) {
          setStats(prev => prev ? { ...prev, currentPrice: trade.price } : null);
        }
      }
    }
  });



  useEffect(() => {
    let isMounted = true;

    const symbol = selectedSymbol || 'SPX';
    const subSymbol = symbol === 'SPX' ? '$SPX' : symbol;

    const fetchData = async (showLoading = true) => {
      try {
        if (showLoading) {
          setStats(null);
          setLoading(true);
        }

        // 1. Fetch via REST for initial load
        const response = await fetch(`/api/scanner/0dte?symbol=${symbol}`);
        const data = await response.json();

        if (isMounted) {
          if (Array.isArray(data)) {
            setZeroDTEOptions(data);
          } else {
            // Only update stats if we got valid data back to avoid flickering
            if (data.stats) {
              setStats(data.stats);
            }
            setZeroDTEOptions(data.options || []);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Failed to fetch 0DTE options:', error);
        if (isMounted) setLoading(false);
      }
    };

    fetchData(true);

    // 2. Request initial live data via WebSocket
    if (isConnected) {
      sendMessage({
        type: 'get_0dte_options',
        underlying: symbol === 'SPX' ? 'SPXW' : symbol,
        date: '0'
      });

      // Subscribe to real-time price for the ticker
      sendMessage({
        type: 'subscribe',
        symbols: [subSymbol]
      });
    }

    // 3. Setup auto-refresh every 30 seconds - SILENT refresh (don't clear stats)
    const interval = setInterval(() => fetchData(false), 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (isConnected) {
        sendMessage({
          type: 'unsubscribe',
          symbols: [subSymbol]
        });
      }
    };
  }, [selectedSymbol, isConnected]);

  const filteredOptions = zeroDTEOptions
    .filter(option => filterType === 'ALL' || option.type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume - a.volume;
        case 'oi':
          return b.openInterest - a.openInterest;
        case 'gamma':
          return Math.abs(b.gamma) - Math.abs(a.gamma);
        case 'delta':
          return Math.abs(b.delta) - Math.abs(a.delta);
        default:
          return 0;
      }
    })
    .slice(0, 15); // Show top 15

  const formatStrike = (strike: number) => {
    return strike ? `$${strike.toFixed(0)}` : '-';
  };

  const formatGreek = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '0.000';
    return value.toFixed(3);
  };

  const getVolumeColor = (volume: number) => {
    if (volume > 1000) return 'text-red-400 font-bold';
    if (volume > 500) return 'text-orange-400 font-semibold';
    if (volume > 200) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getOIColor = (oi: number) => {
    if (oi > 5000) return 'text-green-400 font-bold';
    if (oi > 2000) return 'text-green-500';
    return 'text-gray-400';
  };

  const isAnomaly = (option: ZeroDTEOption) => {
    // Unusual Volume Rule 1: Volume > OI (New money entering aggressively)
    const highVolumeVsOI = option.volume > option.openInterest && option.volume > 500;
    // Unusual Volume Rule 2: Absolute high volume for the day
    const absoluteHighVolume = option.volume > 2000;

    return highVolumeVsOI || absoluteHighVolume;
  };

  const getAnomalyType = (option: ZeroDTEOption) => {
    if (option.volume > option.openInterest && option.volume > 500) return 'HIGH_RELATIVE_VOLUME';
    if (option.volume > 2000) return 'HIGH_ABSOLUTE_VOLUME';
    return null;
  };

  return (
    <div className="glass-surface rounded-2xl overflow-hidden border border-white/[0.05] shadow-2xl">
      {/* Live Trading Tape Ticker */}
      <div className="bg-base/30 backdrop-blur-sm border-b border-white/[0.05]">
        <LiveFlowTicker />
      </div>

      <div className="p-1">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between p-6 gap-6">
          <div className="flex items-center space-x-6">
            <div className="flex items-center bg-base/50 border border-white/10 rounded-xl p-1 shadow-inner backdrop-blur-md">
              <div className="px-5 py-2 text-sm font-black text-accent uppercase tracking-widest border-r border-white/5 bg-accent/5 rounded-l-lg">
                <span className="opacity-50 mr-2 text-[10px]">$</span>{selectedSymbol || 'SPX'}
              </div>

              <div className="flex p-1 gap-1">
                {[
                  { mode: 'DEX', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
                  { mode: 'GEX', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
                  { mode: 'VEX', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' }
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => setChartMode(item.mode as any)}
                    className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${chartMode === item.mode
                      ? `${item.bg} ${item.color} ${item.border} shadow-lg shadow-black/20 scale-105`
                      : 'text-ink-tertiary hover:text-ink-secondary hover:bg-white/5'
                      }`}
                  >
                    {item.mode}
                  </button>
                ))}
              </div>
            </div>

            {stats && (stats as any).targetDate && (
              <div className="flex flex-col">
                <span className="text-[10px] text-ink-tertiary uppercase font-black tracking-widest leading-none mb-1.5 ml-1">Expiration</span>
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 text-white text-[11px] rounded-lg data-font font-bold tracking-tight">
                  {(stats as any).targetDate}
                </span>
              </div>
            )}
          </div>

          {stats && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Institution Levels */}
              <div className="flex bg-base/40 rounded-xl border border-white/5 p-1 shadow-inner">
                {[
                  { label: 'CALL WALL', value: stats.callWall, color: 'text-negative', glow: 'glow-crimson' },
                  { label: 'PUT WALL', value: stats.putWall, color: 'text-positive', glow: 'glow-cyan' },
                  { label: 'PINNING', value: stats.pinningTarget, color: 'text-warning' },
                  { label: 'MAX PAIN', value: stats.maxPain, color: 'text-pink-400' }
                ].filter(item => item.value != null).map((item, idx) => (
                  <div key={item.label} className={`flex flex-col items-center justify-center min-w-[90px] px-4 py-2 ${idx !== 0 ? 'border-l border-white/5' : ''}`}>
                    <span className={`text-[8px] font-black uppercase tracking-widest mb-1.5 ${item.color} opacity-80`}>{item.label}</span>
                    <span className={`text-white data-font text-sm font-bold tracking-tighter ${item.glow ? 'relative inline-block' : ''}`}>
                      {formatStrike(item.value!)}
                      {item.glow && <span className={`absolute -inset-1 blur-sm bg-current opacity-20 rounded-full ${item.glow}`}></span>}
                    </span>
                  </div>
                ))}
              </div>

              {/* Spot Price */}
              {stats.currentPrice != null && (
                <div className="bg-accent/5 border border-accent/20 rounded-xl px-5 py-2.5 shadow-[0_0_20px_rgba(0,242,255,0.05)]">
                  <span className="block text-[8px] text-accent uppercase font-black tracking-[0.2em] mb-1">Spot Price</span>
                  <span className="text-white data-font text-lg font-black leading-none">${stats.currentPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 mt-2">
          {/* Sentiment Layer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6">
              <MarketSentimentGauge
                value={stats?.volatilityImplied ? Math.max(0, Math.min(100, 100 - ((stats.volatilityImplied - 12) / (40 - 12)) * 100)) : 52}
                label="Fear & Greed (VIX)"
              />
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6">
              <MarketSentimentGauge
                value={stats?.drift !== undefined ? 50 + (stats.drift * 10) : 48}
                label="Price Drift Momentum"
              />
            </div>
          </div>

          {/* Core Visualizer */}
          {stats && stats.strikes && stats.strikes.length > 0 && (
            <div className="w-full mb-10 bg-base/20 rounded-3xl p-4 border border-white/[0.02]">
              <GammaProfileChart
                data={stats.strikes}
                currentPrice={stats.currentPrice}
                symbol={(stats as any).fetchedSymbol || selectedSymbol}
                mode={chartMode}
                gammaFlip={stats.gammaFlip}
                maxPain={stats.maxPain}
              />
            </div>
          )}

          {/* Dealer Execution Intelligence */}
          {stats && stats.strikes && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden shadow-inner">
              <div className="px-6 py-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="h-3.5 w-3.5 text-accent" />
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest italic">Dealer Execution Matrix</h3>
                </div>
                <div className="flex items-center space-x-3 text-[9px] font-bold text-ink-tertiary uppercase tracking-tighter">
                  <span>Delta Hedging</span>
                  <span className="w-1 h-1 rounded-full bg-ink-muted"></span>
                  <span>Gamma Sensitivity</span>
                </div>
              </div>
              <div className="p-4">
                <DealerDecisionMatrix
                  netDex={stats.strikes.reduce((acc, s) => acc + (s.callDex || 0) + (s.putDex || 0), 0)}
                  netGex={stats.strikes.reduce((acc, s) => acc + (s.callGex || 0) + (s.putGex || 0), 0)}
                  netVex={stats.strikes.reduce((acc, s) => acc + (s.callVanna || 0) + (s.putVanna || 0), 0)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
