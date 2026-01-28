import { useEffect } from 'react';
import { X, AlertTriangle, TrendingUp, TrendingDown, Volume2 } from 'lucide-react';
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
  useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      onClose(alert.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [alert.id, onClose]);

  const getAlertIcon = () => {
    switch (alert.type) {
      case 'sweep':
        return <Volume2 className="h-5 w-5 text-yellow-500" />;
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
    switch (alert.type) {
      case 'sweep':
        return 'border-yellow-500 bg-yellow-900';
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
    // If it's already a formatted time string (HH:MM:SS), return it
    if (timestamp.includes(':')) return timestamp;

    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`
      relative p-4 rounded-lg border-2 shadow-lg backdrop-blur-md transform transition-all duration-300 ease-in-out hover:scale-105
      ${getAlertColor()}
    `}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 bg-black/20 p-1.5 rounded-md">
          {getAlertIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white mb-1 uppercase tracking-tight">
            {alert.message}
          </div>

          <div className="flex items-center space-x-3 text-[10px] font-bold text-white/70">
            <span className="bg-white/10 px-1.5 py-0.5 rounded">{alert.symbol}</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded">${alert.price.toFixed(2)}</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded">{alert.size} contracts</span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-white/40 font-mono">
              {formatTime(alert.timestamp)}
            </span>
            {alert.exchange && (
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-black italic">
                {alert.exchange}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() => onClose(alert.id)}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      <div className="absolute bottom-0 left-0 h-1 bg-white bg-opacity-30 rounded-full" style={{
        animation: 'progress 5s linear forwards'
      }}></div>

      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

interface AlertContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function AlertContainer({ position = 'top-right' }: AlertContainerProps) {
  const { sweepAlerts, removeSweepAlert } = useMarketStore();

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

  // Show only the 3 most recent alerts to avoid cluttering the screen
  const visibleAlerts = sweepAlerts.slice(0, 3);

  return (
    <div className={`fixed z-[100] space-y-3 w-80 ${positionClasses[position]}`}>
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