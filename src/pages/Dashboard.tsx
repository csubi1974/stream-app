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
    <div className="min-h-screen bg-gray-900">
      <Header />
      <AlertContainer position="top-right" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {t('TapeReading Platform')}
          </h1>
          <p className="text-gray-400">
            {t('Real-time analysis')}
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${isConnected
            ? 'bg-green-900 text-green-300'
            : 'bg-red-900 text-red-300'
            }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
            <span>{isConnected ? t('Connected to market data') : t('Disconnected from market data')}</span>
          </div>
        </div>

        {/* Market Stats Cards */}
        <QuickStatsCards />

        {/* GEX Metrics HUD */}
        <div className="mb-6">
          <GEXMetricsHUD />
        </div>

        {/* Main Content Grid */}
        <div className="space-y-6">
          <ZeroDTEScanner />
          <VolumeScanner />
        </div>
      </main>
    </div>
  );
}
