import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useMarketStore, OptionsBookData } from '../../stores/marketStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTranslation } from 'react-i18next';

interface OptionsLadderProps {
  symbol: string;
}

export function OptionsLadder({ symbol }: OptionsLadderProps) {
  const { t } = useTranslation();
  const { optionsBooks, setOptionsBook } = useMarketStore();
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const bookData = optionsBooks[symbol] || { bids: [], asks: [], last: { price: 0, size: 0, time: '' } };
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

  const { isConnected, sendMessage } = useWebSocket({
    url: wsUrl,
    onConnect: () => {
      // Request options book for this symbol
      sendMessage({
        type: 'get_options_book',
        symbol: symbol
      });
    },
    onMessage: (message) => {
      if (message.type === 'options_book' && message.symbol === symbol) {
        setOptionsBook(symbol, message.data);
      }
    }
  });

  useEffect(() => {
    fetchOptionsBook();
  }, [symbol]);

  const fetchOptionsBook = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/options-book/${symbol}`);
      const data = await response.json();
      setOptionsBook(symbol, data);
    } catch (error) {
      console.error('❌ Failed to fetch options book:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !bookData) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('Options Ladder Title')} {symbol}</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? t('Live') : t('Offline')}
            </span>
          </div>
        </div>
        <div className="animate-pulse space-y-2">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{t('Options Ladder Title')} {symbol}</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
          <span className="text-sm text-gray-400">
            {isConnected ? t('Live') : t('Offline')}
          </span>
        </div>
      </div>

      {/* Ladder Display */}
      <div className="space-y-1">
        {/* Asks (Red) */}
        {(Array.isArray(bookData.asks) ? [...bookData.asks] : []).reverse().map((ask, index) => (
          <div
            key={`ask-${index}`}
            onClick={() => setSelectedLevel(ask.price)}
            className={`
              flex items-center justify-between p-2 rounded cursor-pointer transition-all
              ${selectedLevel === ask.price ? 'bg-gray-600 ring-2 ring-blue-500' : 'hover:bg-gray-700'}
            `}
          >
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-red-400 font-bold">{ask.price.toFixed(2)}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white font-bold">{ask.size}</span>
              <span className="text-gray-400 text-sm">{ask.exchange}</span>
            </div>
          </div>
        ))}

        {/* Last Trade */}
        <div className="bg-gray-700 rounded-lg p-3 my-2 border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-400 font-bold">{t('Last Trade')}</span>
            </div>
            <div className="text-center">
              <div className="text-white font-bold text-lg">{bookData.last?.price?.toFixed(2) || '0.00'}</div>
              <div className="text-gray-400 text-sm">{bookData.last?.size || 0} @ {bookData.last?.time || ''}</div>
            </div>
          </div>
        </div>

        {/* Bids (Green) */}
        {(Array.isArray(bookData.bids) ? bookData.bids : []).map((bid, index) => (
          <div
            key={`bid-${index}`}
            onClick={() => setSelectedLevel(bid.price)}
            className={`
              flex items-center justify-between p-2 rounded cursor-pointer transition-all
              ${selectedLevel === bid.price ? 'bg-gray-600 ring-2 ring-blue-500' : 'hover:bg-gray-700'}
            `}
          >
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span className="text-green-400 font-bold">{bid.price.toFixed(2)}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white font-bold">{bid.size}</span>
              <span className="text-gray-400 text-sm">{bid.exchange}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Level Info */}
      {selectedLevel && (
        <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded-lg">
          <div className="text-blue-200 text-sm">{t('Selected Level')}</div>
          <div className="text-white font-bold">${selectedLevel.toFixed(2)}</div>
          <div className="text-blue-300 text-xs mt-1">
            {t('Selected Level Tip')}
          </div>
        </div>
      )}
    </div>
  );
}
