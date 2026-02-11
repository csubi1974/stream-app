import { useEffect } from 'react';
import { X, AlertTriangle, TrendingUp, TrendingDown, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore, TradeData } from '../../stores/marketStore';

interface AlertToastProps {
  alert: TradeData & {
    id: string;
    type: 'sweep' | 'unusual_volume' | 'price_alert' | 'vwap_break';
    message: string;
    timestamp: string;
  };
  onClose: (id: string) => void;
}

export function AlertToast({ alert, onClose }: AlertToastProps) {
  const { t } = useTranslation();
  useEffect(() => {
    // Priority-based auto-dismiss
    // Standard alerts: 4s, Large sweeps: 6s
    const isPriority = (alert.totalSize || alert.size) > 1000;
    const duration = isPriority ? 6000 : 4000;

    const timer = setTimeout(() => {
      onClose(alert.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [alert.id, onClose, alert.totalSize, alert.size]);

  const getAlertIcon = () => {
    const isBig = (alert.totalSize || alert.size) > 1000;
    switch (alert.type) {
      case 'sweep':
        return <Volume2 className={`h-5 w-5 ${isBig ? 'text-red-400 animate-pulse' : 'text-yellow-500'}`} />;
      case 'unusual_volume':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'price_alert':
        return alert.side === 'BUY' ?
          <TrendingUp className="h-5 w-5 text-green-500" /> :
          <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'vwap_break':
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAlertColor = () => {
    const isBig = (alert.totalSize || alert.size) > 1000;
    if (isBig && alert.type === 'sweep') {
      return 'border-red-500/50 bg-gradient-to-br from-red-900/80 to-black/90 shadow-red-500/20';
    }

    switch (alert.type) {
      case 'sweep':
        return 'border-yellow-500/40 bg-gradient-to-br from-yellow-900/40 to-black/80 shadow-yellow-500/10';
      case 'unusual_volume':
        return 'border-orange-500 bg-orange-900';
      case 'price_alert':
        return alert.side === 'BUY' ?
          'border-green-500 bg-green-900' :
          'border-red-500 bg-red-900';
      case 'vwap_break':
        return 'border-blue-500 bg-blue-900';
      default:
        return 'border-gray-500 bg-gray-900';
    }
  };

  const formatTime = (timestamp: string) => {
    if (timestamp.includes(':') && timestamp.length <= 11) return timestamp;
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const isBigSweep = (alert.totalSize || alert.size) > 1000;

  return (
    <div className={`
      relative p-4 rounded-xl border shadow-2xl backdrop-blur-xl transform transition-all duration-500 ease-out hover:scale-[1.02] overflow-hidden
      ${getAlertColor()}
    `}>
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>

      <div className="flex items-start space-x-4 relative z-10">
        <div className={`flex-shrink-0 p-2 rounded-lg ${isBigSweep ? 'bg-red-500/20' : 'bg-black/40 shadow-inner'}`}>
          {getAlertIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${isBigSweep ? 'text-red-400' : 'text-yellow-500 opacity-80'}`}>
              {isBigSweep ? t('EXTREME SWEEP') : t(alert.message)}
            </div>
            {(alert.count || 0) > 1 && (
              <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg shadow-blue-500/20">
                {t('STACKED')} x{alert.count}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-white/10 text-white font-black px-2 py-1 rounded text-xs border border-white/5">{alert.symbol}</span>
            <span className="bg-black/40 text-blue-300 font-mono px-2 py-1 rounded text-xs border border-blue-500/20">${alert.price.toFixed(2)}</span>
            <span className={`px-2 py-1 rounded text-xs font-bold border ${isBigSweep ? 'bg-red-500 text-white border-red-400' : 'bg-white/5 text-white/90 border-white/10'}`}>
              {alert.totalSize || alert.size} contracts
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30 font-mono italic">
              {formatTime(alert.timestamp)}
            </span>
            {alert.exchange && (
              <span className="text-[9px] text-white/20 uppercase tracking-widest font-black italic">
                {alert.exchange}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() => onClose(alert.id)}
            className="p-1 rounded-full hover:bg-white/10 text-white/20 hover:text-white transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Progress Bar */}
      <div className={`absolute bottom-0 left-0 h-[3px] opacity-60 rounded-full ${isBigSweep ? 'bg-red-500' : 'bg-white'}`} style={{
        width: '100%',
        animation: `progress ${(alert.totalSize || alert.size) > 1000 ? '6s' : '4s'} linear forwards`
      }}></div>

      <style>{`
        @keyframes progress {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

interface AlertContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function AlertContainer({ position }: AlertContainerProps) {
  const { sweepAlerts, removeSweepAlert, settings } = useMarketStore();

  const currentPosition = position || settings.alertPosition || 'top-right';

  const positionClasses = {
    'top-right': 'top-20 right-6',
    'top-left': 'top-20 left-6',
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6'
  };

  const handleCloseAlert = (timestamp: string, symbol: string) => {
    removeSweepAlert(timestamp, symbol);
  };

  if (sweepAlerts.length === 0) {
    return null;
  }

  // QUALITY FILTER: Only show pop-ups for high impact sweeps
  // If size is less than 2x threshold, we don't show the toast (just list it in the panel)
  // This reduces intrusiveness as requested.
  const visibleAlerts = sweepAlerts
    .filter(a => (a.totalSize || a.size) >= (settings.sweepThreshold * 1.5))
    .slice(0, 3);

  if (visibleAlerts.length === 0) return null;

  return (
    <div className={`fixed z-[100] space-y-3 w-85 ${positionClasses[currentPosition]}`}>
      {visibleAlerts.map((alert, index) => (
        <AlertToast
          key={`${alert.symbol}-${alert.timestamp}-${index}`}
          alert={{
            ...alert,
            id: `${alert.symbol}-${alert.timestamp}-${index}`,
            type: 'sweep',
            message: `🚨 SWEEP DETECTED`
          }}
          onClose={() => handleCloseAlert(alert.timestamp, alert.symbol)}
        />
      ))}
    </div>
  );
}

// Hook for creating alerts
export function useAlertSystem() {
  const { addSweepAlert } = useMarketStore();

  const createSweepAlert = (trade: TradeData) => {
    const alert = {
      ...trade,
      id: `${trade.symbol}-${trade.timestamp}-${Math.random()}`,
      type: 'sweep' as const,
      message: `🚨 SWEEP: ${trade.size} contracts @ $${trade.price.toFixed(2)}`,
      timestamp: new Date().toISOString()
    };

    addSweepAlert(trade);

    // Optional: Play sound
    if (typeof window !== 'undefined' && window.AudioContext) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch (error) {
        console.warn('Could not play alert sound:', error);
      }
    }
  };

  const createUnusualVolumeAlert = (symbol: string, volume: number, rvol: number) => {
    const alert = {
      symbol,
      price: 0,
      size: volume,
      side: 'BUY' as const,
      exchange: 'SCANNER',
      timestamp: new Date().toISOString(),
      id: `${symbol}-volume-${Date.now()}`,
      type: 'unusual_volume' as const,
      message: `📊 Unusual volume: ${symbol} RVOL ${rvol.toFixed(1)}x`
    };

    // Add to store (you'd need to add a method for this)
    console.log('Volume alert:', alert);
  };

  return {
    createSweepAlert,
    createUnusualVolumeAlert
  };
}