import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/layout/Header';
import { ZeroDTEScanner } from '../components/dashboard/ZeroDTEScanner';
import { VolumeScanner } from '../components/dashboard/VolumeScanner';
import { SweepAlerts } from '../components/dashboard/SweepAlerts';
import { GEXMetricsHUD } from '../components/dashboard/GEXMetricsHUD';
import { QuickStatsCards } from '../components/dashboard/QuickStatsCards';
import { AlertContainer } from '../components/alerts/AlertToast';
import { useMarketStore } from '../stores/marketStore';
import { useWebSocket } from '../hooks/useWebSocket';

export function Dashboard() {
  const { t } = useTranslation();
  const {
    subscribedSymbols,
    addSubscribedSymbol,
    removeSubscribedSymbol,
    setSelectedSymbol
  } = useMarketStore();

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    url: wsUrl,
    onConnect: () => {
      console.log('📡 Connected to market data stream');
      // No auto-subscribe - user needs to explicitly add symbols from watchlist or scanner
    },
    onMessage: (message) => {
      console.log('📊 Market data update:', message.type);
      // Handle real-time updates here if needed
    }
  });

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (isConnected) {
        unsubscribe(subscribedSymbols);
        subscribedSymbols.forEach(symbol => removeSubscribedSymbol(symbol));
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-base pb-12">
      <Header />
      <AlertContainer position="top-right" />

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-white/[0.05]">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white tracking-tight uppercase italic flex items-center space-x-3">
              <span className="w-1 h-6 bg-accent rounded-full inline-block"></span>
              <span>{t('TapeReading Platform')}</span>
            </h1>
            <p className="text-[10px] text-ink-tertiary uppercase tracking-[0.2em] font-bold">
              {t('Real-time analysis')} • <span className="text-accent">INSTITUTIONAL FLOW MONITOR</span>
            </p>
          </div>

          {/* Connection Status */}
          <div className="mt-4 md:mt-0">
            <div className={`inline-flex items-center space-x-3 px-4 py-1.5 rounded-full border shadow-sm transition-all ${isConnected
              ? 'bg-positive/5 border-positive/20 text-positive'
              : 'bg-negative/5 border-negative/20 text-negative'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-positive shadow-[0_0_8px_rgba(0,255,163,0.5)] animate-pulse' : 'bg-negative shadow-[0_0_8px_rgba(255,0,85,0.5)]'
                }`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest">{isConnected ? t('Connected to market data') : t('Disconnected from market data')}</span>
            </div>
          </div>
        </div>

        {/* Market Stats Cards */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <QuickStatsCards />
        </div>

        {/* HUD & Main Scanner */}
        <div className="space-y-6">
          <div className="glass-surface rounded-2xl overflow-hidden border border-white/[0.05] shadow-2xl">
            <div className="bg-white/[0.02] border-b border-white/[0.05] px-6 py-4">
              <h2 className="text-[10px] font-black text-ink-tertiary uppercase tracking-widest leading-none">Global GEX Overview</h2>
            </div>
            <div className="p-6">
              <GEXMetricsHUD />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12">
              <ZeroDTEScanner />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="glass-surface rounded-2xl overflow-hidden border border-white/[0.05] shadow-xl">
              <div className="bg-white/[0.02] border-b border-white/[0.05] px-6 py-3">
                <h2 className="text-[10px] font-black text-ink-tertiary uppercase tracking-widest leading-none">Market Volume Heatmap</h2>
              </div>
              <div className="p-4">
                <VolumeScanner />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
