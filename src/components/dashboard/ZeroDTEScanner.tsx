import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore, ZeroDTEOption } from '../../stores/marketStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Link } from 'react-router-dom';
import { GammaProfileChart } from '../charts/GammaProfileChart';

interface ScanStats {
  callWall: number;
  putWall: number;
  totalVolume: number;
  currentPrice?: number;
  strikes: any[];
}

export function ZeroDTEScanner() {
  const { t } = useTranslation();
  const { zeroDTEOptions, setZeroDTEOptions } = useMarketStore();
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'oi' | 'gamma' | 'delta'>('volume');
  const [filterType, setFilterType] = useState<'ALL' | 'CALL' | 'PUT'>('ALL');

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
        // Backend now returns { options: [], stats: {} }
        // Handle both old array format (just in case) and new object format
        if (Array.isArray(message.data)) {
          setZeroDTEOptions(message.data);
        } else {
          setZeroDTEOptions(message.data.options);
          setStats(message.data.stats);
        }
      }
    }
  });

  useEffect(() => {
    fetchZeroDTEOptions();
  }, []);

  const fetchZeroDTEOptions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scanner/0dte');
      const data = await response.json();

      if (Array.isArray(data)) {
        setZeroDTEOptions(data);
      } else {
        setZeroDTEOptions(data.options);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('❌ Failed to fetch 0DTE options:', error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <Clock className="h-5 w-5 mr-2 text-blue-500" />
          {t('0DTE Options Scanner')}
        </h2>

        {stats && (
          <div className="flex space-x-4 bg-gray-900 px-3 py-1 rounded-lg border border-gray-700">
            <div className="text-center">
              <span className="block text-[10px] text-red-400 uppercase font-bold">{t('Resis / Call Wall')}</span>
              <span className="text-white font-mono">{formatStrike(stats.callWall)}</span>
            </div>
            <div className="w-[1px] bg-gray-700"></div>
            <div className="text-center">
              <span className="block text-[10px] text-green-400 uppercase font-bold">{t('Supp / Put Wall')}</span>
              <span className="text-white font-mono">{formatStrike(stats.putWall)}</span>
            </div>
            {stats.currentPrice && (
              <>
                <div className="w-[1px] bg-gray-700"></div>
                <div className="text-center">
                  <span className="block text-[10px] text-blue-400 uppercase font-bold">{t('Spot')}</span>
                  <span className="text-white font-mono">${stats.currentPrice.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
          <span className="text-sm text-gray-400">
            {isConnected ? t('Live') : t('Offline')}
          </span>
        </div>
      </div>

      {/* Gamma Chart */}
      {stats && stats.strikes && stats.strikes.length > 0 && (
        <div className="mb-6">
          <GammaProfileChart data={stats.strikes} currentPrice={stats.currentPrice} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('Filter')}</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'ALL' | 'CALL' | 'PUT')}
            className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">{t('All Options')}</option>
            <option value="CALL">{t('Calls Only')}</option>
            <option value="PUT">{t('Puts Only')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('Sort By')}</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'volume' | 'oi' | 'gamma' | 'delta')}
            className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="volume">{t('Volume')}</option>
            <option value="oi">{t('Open Interest')}</option>
            <option value="gamma">{t('Gamma')}</option>
            <option value="delta">{t('Delta')}</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchZeroDTEOptions}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            {t('Refresh')}
          </button>
        </div>
      </div>

      {/* Options Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Symbol')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Type')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Strike')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Last')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Bid')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Ask')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Volume')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('OI')}</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">Δ</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">Γ</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t('Action')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredOptions.map((option) => (
              <tr
                key={option.symbol}
                className="border-b border-gray-700 hover:bg-gray-700 transition-colors"
              >
                <td className="py-2 px-2">
                  <div className="font-semibold text-white text-xs">
                    {option.symbol}
                  </div>
                </td>

                <td className="py-2 px-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${option.type === 'CALL'
                    ? 'bg-green-900 text-green-300'
                    : 'bg-red-900 text-red-300'
                    }`}>
                    {option.type}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className={`font-medium ${stats && Math.abs((option.strike || (option as any).strikePrice) - stats.callWall) < 1 ? 'text-red-400 border border-red-500 px-1 rounded' :
                    stats && Math.abs((option.strike || (option as any).strikePrice) - stats.putWall) < 1 ? 'text-green-400 border border-green-500 px-1 rounded' : 'text-white'
                    }`}>
                    {formatStrike(option.strike || (option as any).strikePrice)}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className="text-white">
                    ${option.last.toFixed(2)}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className="text-gray-400">
                    ${option.bid.toFixed(2)}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className="text-gray-400">
                    ${option.ask.toFixed(2)}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className={getVolumeColor(option.volume)}>
                    {option.volume.toLocaleString()}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className={getOIColor(option.openInterest)}>
                    {option.openInterest.toLocaleString()}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className="text-gray-300 text-xs">
                    {formatGreek(option.delta)}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <span className="text-gray-300 text-xs">
                    {formatGreek(option.gamma)}
                  </span>
                </td>

                <td className="py-2 px-2">
                  <Link
                    to={`/ladder/${option.symbol}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                  >
                    {t('Ladder')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredOptions.length === 0 && (
        <div className="text-center py-8">
          <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">{t('No options found')}</p>
          <p className="text-xs text-gray-500 mt-1">
            {t('Waiting for market data')}
          </p>
        </div>
      )}

      {/* Summary */}
      {filteredOptions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-gray-400 text-xs">{t('Total Options')}</div>
              <div className="text-white font-bold">{filteredOptions.length}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs">{t('High Volume')}</div>
              <div className="text-orange-400 font-bold">
                {filteredOptions.filter(o => o.volume > 500).length}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs">{t('High OI')}</div>
              <div className="text-green-400 font-bold">
                {filteredOptions.filter(o => o.openInterest > 2000).length}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs">{t('Call/Put Ratio')}</div>
              <div className="text-blue-400 font-bold">
                {(() => {
                  const calls = filteredOptions.filter(o => o.type === 'CALL').length;
                  const puts = Math.max(filteredOptions.filter(o => o.type === 'PUT').length, 1);
                  return (calls / puts).toFixed(1);
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
