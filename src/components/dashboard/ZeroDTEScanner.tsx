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
  totalVolume: number;
  currentPrice?: number;
  strikes: any[];
  targetDate?: string;
  deltaTarget?: number;
  volatilityImplied?: number;
  drift?: number;
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
  const commonSymbols = ['SPX', 'SPY', 'QQQ', 'IWM', 'AAPL', 'NVDA', 'TSLA', 'AMD'];

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

  const { isConnected, sendMessage } = useWebSocket({
    url: wsUrl,
    onConnect: () => {
      sendMessage({
        type: 'get_0dte_options',
        underlying: 'SPXW'
      });
    },
    onMessage: (message) => {
      if (message.type === '0dte_options') {
        let options: ZeroDTEOption[] = [];
        if (Array.isArray(message.data)) {
          options = message.data;
          setZeroDTEOptions(message.data);
        } else {
          options = message.data.options;
          setZeroDTEOptions(message.data.options);
          setStats(message.data.stats);
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

        // Add to global store for the Ticker
        useMarketStore.getState().addTrade({
          symbol: trade.symbol,
          price: trade.price,
          size: trade.size,
          side: trade.side || 'N/A',
          exchange: trade.exchange || 'N/A',
          timestamp: new Date().toLocaleTimeString()
        });

        // If it's a large trade, add to sweep alerts
        if (trade.size >= 500) {
          useMarketStore.getState().addSweepAlert({
            symbol: trade.symbol,
            price: trade.price,
            size: trade.size,
            side: trade.side || 'N/A',
            exchange: trade.exchange || 'N/A',
            timestamp: new Date().toLocaleTimeString()
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

    const fetchData = async () => {
      try {
        setStats(null);
        setLoading(true);

        // 1. Fetch via REST for initial load
        const response = await fetch(`/api/scanner/0dte?symbol=${symbol}`);
        const data = await response.json();

        if (isMounted) {
          if (Array.isArray(data)) {
            setZeroDTEOptions(data);
          } else {
            setZeroDTEOptions(data.options);
            setStats(data.stats);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Failed to fetch 0DTE options:', error);
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

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

    // 3. Setup auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

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

  const formatGreek = (value: number) => {
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
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-2xl border border-gray-700">
      {/* Live Trading Tape Ticker */}
      <LiveFlowTicker />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-3 text-blue-500" />

            <div className="ml-6 flex items-center bg-gray-900 border border-gray-700 rounded-lg p-0.5 relative">
              <div className="px-4 py-1.5 text-sm font-black text-blue-400 uppercase tracking-[0.2em] border-r border-gray-800 bg-blue-500/5 rounded-l-md">
                {selectedSymbol || 'SPX'}
              </div>

              <div className="w-[1px] h-4 bg-gray-700 mx-1"></div>

              <button
                onClick={() => setChartMode('DEX')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartMode === 'DEX'
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'text-gray-400 hover:bg-gray-700'
                  }`}
              >
                DEX
              </button>
              <button
                onClick={() => setChartMode('GEX')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartMode === 'GEX'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:bg-gray-700'
                  }`}
              >
                GEX
              </button>
              <button
                onClick={() => setChartMode('VEX')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartMode === 'VEX'
                  ? 'bg-purple-600/80 text-white shadow-lg'
                  : 'text-gray-400 hover:bg-gray-700'
                  }`}
              >
                VEX
              </button>
            </div>



            {stats && (stats as any).targetDate && (
              <span className="ml-3 px-2 py-0.5 bg-blue-900/30 border border-blue-500/30 text-blue-400 text-[10px] rounded font-mono uppercase font-bold">
                Exp: {(stats as any).targetDate}
              </span>
            )}
          </div>

          {stats && (
            <div className="flex space-x-6 items-center">
              <div className="flex space-x-4 bg-gray-900/80 px-4 py-1.5 rounded-lg border border-gray-700 shadow-inner">
                {/* Wall Labels */}
                <div className="text-center group cursor-help min-w-[70px]">
                  <span className="block text-[8px] text-red-400 uppercase font-black tracking-tighter line-clamp-1 leading-none mb-1">
                    {t('RESIS / PARED CALL')}
                  </span>
                  <span className="text-white font-mono text-sm font-bold">{formatStrike(stats.callWall)}</span>
                </div>

                <div className="w-[1px] bg-gray-800"></div>

                <div className="text-center group cursor-help min-w-[70px]">
                  <span className="block text-[8px] text-green-400 uppercase font-black tracking-tighter line-clamp-1 leading-none mb-1">
                    {t('SOP / PARED PUT')}
                  </span>
                  <span className="text-white font-mono text-sm font-bold">{formatStrike(stats.putWall)}</span>
                </div>

                {stats.currentPrice && (
                  <>
                    <div className="w-[1px] bg-gray-800"></div>
                    <div className="text-center min-w-[80px]">
                      <span className="block text-[8px] text-blue-400 uppercase font-black tracking-tighter leading-none mb-1">SPOT</span>
                      <span className="text-white font-mono text-sm font-bold">${stats.currentPrice.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {stats.deltaTarget !== undefined && (
                  <>
                    <div className="w-[1px] bg-gray-800"></div>
                    <div className="text-center min-w-[60px]">
                      <span className="block text-[8px] text-purple-400 uppercase font-black tracking-tighter leading-none mb-1">TARGET Δ</span>
                      <span className="text-white font-mono text-sm font-bold">{stats.deltaTarget.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {stats.volatilityImplied !== undefined && (
                  <>
                    <div className="w-[1px] bg-gray-800"></div>
                    <div className="text-center min-w-[60px]">
                      <span className="block text-[8px] text-amber-400 uppercase font-black tracking-tighter leading-none mb-1">IV</span>
                      <span className="text-white font-mono text-sm font-bold">{(stats.volatilityImplied).toFixed(1)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6">
          {/* 1. Sentiment Analysis Gauges - Row Layout */}
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-6">
            <div className="flex-1">
              <MarketSentimentGauge
                value={stats?.volatilityImplied ? Math.min(100, (stats.volatilityImplied / 40) * 100) : 52}
                label="Fear & Greed (VIX)"
              />
            </div>
            <div className="flex-1">
              <MarketSentimentGauge
                value={stats?.drift !== undefined ? 50 + (stats.drift * 10) : 48}
                label="Price Drift Momentum"
              />
            </div>
          </div>

          {/* 2. Gamma/Vanna Chart - Full Width */}
          {stats && stats.strikes && stats.strikes.length > 0 && (
            <div className="w-full mb-8">
              <GammaProfileChart
                data={stats.strikes}
                currentPrice={stats.currentPrice}
                symbol={(stats as any).fetchedSymbol || selectedSymbol}
                mode={chartMode}
              />
            </div>
          )}

          {/* 3. Dealer Decision Matrix (Estado del Dealer) */}
          {stats && stats.strikes && (
            <div className="mb-6">
              <DealerDecisionMatrix
                netDex={stats.strikes.reduce((acc, s) => acc + (s.callDex || 0) + (s.putDex || 0), 0)}
                netGex={stats.strikes.reduce((acc, s) => acc + (s.callGex || 0) + (s.putGex || 0), 0)}
                netVex={stats.strikes.reduce((acc, s) => acc + (s.callVanna || 0) + (s.putVanna || 0), 0)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
