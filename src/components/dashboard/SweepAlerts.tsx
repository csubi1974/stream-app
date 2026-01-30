import { useEffect } from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore } from '../../stores/marketStore';
import { useWebSocket } from '../../hooks/useWebSocket';

export function SweepAlerts() {
  const { t } = useTranslation();
  const { sweepAlerts, addSweepAlert, clearSweepAlerts } = useMarketStore();

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

  const { isConnected } = useWebSocket({
    url: wsUrl,
    onMessage: (message) => {
      if (message.type === 'sweep_alert' && message.data) {
        addSweepAlert(message.data);
      }
    }
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
          {t('Sweep Alerts')}
        </h2>
        <div className="flex items-center space-x-2">
          {isConnected && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-500">{t('Live')}</span>
            </div>
          )}
          <button
            onClick={clearSweepAlerts}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {t('Clear')}
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sweepAlerts.map((alert, index) => (
          <div
            key={`${alert.symbol}-${alert.timestamp}-${index}`}
            className="bg-yellow-900 border border-yellow-700 rounded-lg p-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-yellow-200 font-medium text-sm">
                  {t('SWEEP DETECTED')}
                </span>
              </div>
              <span className="text-xs text-yellow-300">
                {formatTime(alert.timestamp)}
              </span>
            </div>
            <div className="mt-2 text-sm">
              <div className="text-white font-bold">
                {alert.size} {t('contracts')} {alert.symbol}
              </div>
              <div className="text-yellow-200">
                @ ${alert.price != null ? alert.price.toFixed(2) : '--'} {t('on')} {alert.exchange}
              </div>
              <div className={`text-xs mt-1 ${alert.side === 'BUY' ? 'text-green-400' : 'text-red-400'
                }`}>
                {alert.side === 'BUY' ? t('AGGRESSIVE BUY') : t('AGGRESSIVE SELL')}
              </div>
            </div>
          </div>
        ))}

        {sweepAlerts.length === 0 && (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{t('No sweep alerts')}</p>
            <p className="text-xs text-gray-500 mt-1">
              {t('Alerts will appear')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
