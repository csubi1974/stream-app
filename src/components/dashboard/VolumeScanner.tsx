import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore, VolumeData } from '../../stores/marketStore';
import { Link } from 'react-router-dom';

interface VolumeScannerProps {
  onSymbolSelect?: (symbol: string) => void;
}

export function VolumeScanner({ onSymbolSelect }: VolumeScannerProps) {
  const { t } = useTranslation();
  const { volumeData, setVolumeData, setSelectedSymbol } = useMarketStore();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    minRvol: 3,
    minDollarVol: 50000000
  });

  useEffect(() => {
    fetchVolumeScanner();
  }, [filters]);

  const fetchVolumeScanner = async () => {
    try {
      const params = new URLSearchParams({
        min_rvol: filters.minRvol.toString(),
        min_dollar_vol: filters.minDollarVol.toString()
      });

      const response = await fetch(`/api/scanner/volume?${params}`);
      const data = await response.json();
      setVolumeData(data);
    } catch (error) {
      console.error('❌ Failed to fetch volume scanner:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStockClick = (stock: VolumeData) => {
    setSelectedSymbol(stock.symbol);
    if (onSymbolSelect) {
      onSymbolSelect(stock.symbol);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('🔴')) return 'text-red-400';
    if (action.includes('🟢')) return 'text-green-400';
    if (action.includes('⚠️')) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const [sortConfig, setSortConfig] = useState<{ key: keyof VolumeData; direction: 'asc' | 'desc' }>({
    key: 'rvol',
    direction: 'desc'
  });

  const handleSort = (key: keyof VolumeData) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedData = [...volumeData].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
            {t('Volume Scanner')}
          </h2>
        </div>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
          {t('Volume Scanner')}
        </h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">{t('Min RVOL')}:</label>
            <input
              type="number"
              value={filters.minRvol}
              onChange={(e) => setFilters(prev => ({ ...prev, minRvol: Number(e.target.value) }))}
              className="bg-gray-700 text-white px-2 py-1 rounded text-sm w-16"
              min="1"
              step="0.1"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">{t('Min $Vol')}:</label>
            <input
              type="number"
              value={filters.minDollarVol / 1000000}
              onChange={(e) => setFilters(prev => ({ ...prev, minDollarVol: Number(e.target.value) * 1000000 }))}
              className="bg-gray-700 text-white px-2 py-1 rounded text-sm w-16"
              min="10"
              step="10"
            />
            <span className="text-sm text-gray-400">M</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto h-[400px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 z-10 shadow-lg">
            <tr className="border-b border-gray-700">
              <th
                className="text-left py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('symbol')}
              >
                {t('Symbol')} {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('price')}
              >
                {t('Price')} {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('rvol')}
              >
                {t('Volume')} {sortConfig.key === 'rvol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('dollarVolume')}
              >
                $Volume {sortConfig.key === 'dollarVolume' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-3 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('changePercent')}
              >
                %Δ {sortConfig.key === 'changePercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-center py-3 px-2 text-gray-400 font-medium">{t('Pressure')}</th>
              <th className="text-left py-3 px-2 text-gray-400 font-medium">{t('Action')}</th>
              <th className="text-center py-3 px-2 text-gray-400 font-medium">{t('View')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((stock) => (
              <tr
                key={stock.symbol}
                className="border-b border-gray-700 hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => handleStockClick(stock)}
              >
                <td className="py-3 px-2">
                  <div className="font-bold text-white">{stock.symbol}</div>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="text-white font-mono">${stock.price?.toFixed(2) || '0.00'}</div>
                </td>
                <td className="py-3 px-2 text-right">
                  <span className={`font-bold ${stock.rvol >= 4 ? 'text-red-400' :
                    stock.rvol >= 3 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                    {stock.rvol.toFixed(1)}x
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-white font-bold">
                  ${(stock.dollarVolume / 1000000).toFixed(0)}M
                </td>
                <td className="py-3 px-2 text-right">
                  <span className={`font-bold ${stock.changePercent > 0 ? 'text-green-400' :
                    stock.changePercent < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                    {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="text-xs text-gray-400">
                      B:{stock.bidHits}%
                    </div>
                    <div className="w-12 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-green-500"
                        style={{
                          width: '100%',
                          background: `linear-gradient(to right, #ef4444 ${100 - stock.bidHits}%, #22c55e ${100 - stock.bidHits}%)`
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-400">
                      A:{stock.askHits}%
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <span className={`font-medium ${getActionColor(stock.action)}`}>
                    {stock.action}
                  </span>
                </td>
                <td className="py-3 px-2 text-center">
                  <Link
                    to={`/scanner/${stock.symbol}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('Chart')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {volumeData.length === 0 && (
        <div className="text-center py-8">
          <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">{t('No stocks match')}</p>
        </div>
      )}
    </div>
  );
}