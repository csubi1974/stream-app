import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { useMarketStore, TradeData } from '../../stores/marketStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTranslation } from 'react-i18next';

interface TimeSalesProps {
  symbol: string;
}

export function TimeSales({ symbol }: TimeSalesProps) {
  const { t } = useTranslation();
  const { timeSales, setTimeSales, addTrade } = useMarketStore();
  const [loading, setLoading] = useState(true);

  const trades = Array.isArray(timeSales[symbol]) ? timeSales[symbol] : [];
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

  const { isConnected, sendMessage } = useWebSocket({
    url: wsUrl,
    onConnect: () => {
      // Request time & sales for this symbol
      sendMessage({
        type: 'get_time_sales',
        symbol: symbol
      });
    },
    onMessage: (message) => {
      if (message.type === 'time_sales' && message.symbol === symbol) {
        setTimeSales(symbol, message.data);
      } else if (message.type === 'option_trade' && message.data?.symbol === symbol) {
        addTrade(message.data);
      }
    }
  });

  useEffect(() => {
    fetchTimeSales();
  }, [symbol]);

  const fetchTimeSales = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/time-sales/${symbol}`);
      const data = await response.json();
      setTimeSales(symbol, data);
    } catch (error) {
      console.error('❌ Failed to fetch time & sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTradeStyle = (trade: TradeData) => {
    const isBuy = trade.side === 'BUY';
    // const isAtAsk = trade.side === 'BUY'; // Simplified logic - removed unused vars
    // const isAtBid = trade.side === 'SELL'; // Simplified logic

    return {
      bgColor: isBuy ? 'bg-green-900' : 'bg-red-900',
      borderColor: isBuy ? 'border-green-700' : 'border-red-700',
      textColor: isBuy ? 'text-green-300' : 'text-red-300',
      icon: isBuy ? TrendingUp : TrendingDown,
      label: isBuy ? t('BUY') : t('SELL')
    };
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Clock className="h-5 w-5 mr-2 text-yellow-500" />
            {t('Time & Sales Title')} {symbol}
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? t('Live') : t('Offline')}
            </span>
          </div>
        </div>
        <div className="animate-pulse space-y-2">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Clock className="h-5 w-5 mr-2 text-yellow-500" />
          {t('Time & Sales Title')} {symbol}
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
          <span className="text-sm text-gray-400">
            {isConnected ? t('Live') : t('Offline')}
          </span>
        </div>
      </div>

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {trades.map((trade, index) => {
          const style = getTradeStyle(trade);
          const Icon = style.icon;

          return (
            <div
              key={`${trade.timestamp}-${index}`}
              className={`
                flex items-center justify-between p-2 rounded border transition-all
                ${style.bgColor} ${style.borderColor} hover:opacity-80
              `}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`h-4 w-4 ${style.textColor}`} />
                <div>
                  <div className="text-white font-bold">
                    ${trade.price.toFixed(2)}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {trade.size} {t('contracts')}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-sm font-bold ${style.textColor}`}>
                  {style.label}
                </div>
                <div className="text-gray-400 text-xs">
                  {formatTime(trade.timestamp)}
                </div>
                <div className="text-gray-500 text-xs">
                  {trade.exchange}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {trades.length === 0 && (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">{t('No trades')}</p>
          <p className="text-xs text-gray-500 mt-1">
            {t('Trades will appear')}
          </p>
        </div>
      )}

      {/* Trade Statistics */}
      {trades.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-gray-400 text-xs">{t('Total Trades')}</div>
              <div className="text-white font-bold">{trades.length}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs">{t('Buy Pressure')}</div>
              <div className="text-green-400 font-bold">
                {((trades.filter(t => t.side === 'BUY').length / trades.length) * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs">{t('Sell Pressure')}</div>
              <div className="text-red-400 font-bold">
                {((trades.filter(t => t.side === 'SELL').length / trades.length) * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
