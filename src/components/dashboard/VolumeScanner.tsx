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
      <div className="glass-surface rounded-2xl p-6 border border-white/[0.05]">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-accent/10 rounded-lg">
            <TrendingUp className="h-4 w-4 text-accent animate-pulse" />
          </div>
          <h2 className="text-[10px] font-black text-white uppercase tracking-widest">
            {t('Volume Scanner')}
          </h2>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/[0.02] rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-accent/10 rounded-lg">
            <Activity className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Volume Heatmap</h3>
            <p className="text-[9px] text-ink-tertiary uppercase tracking-wider font-semibold mt-0.5">Real-time Flow Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-base/50 border border-white/10 rounded-lg px-3 py-1.5">
            <label className="text-[9px] text-ink-tertiary uppercase font-black tracking-widest">Min RVOL:</label>
            <input
              type="number"
              value={filters.minRvol}
              onChange={(e) => setFilters(prev => ({ ...prev, minRvol: Number(e.target.value) }))}
              className="bg-white/5 text-white px-2 py-1 rounded text-xs w-14 data-font font-bold border border-white/10 focus:border-accent/50 focus:outline-none transition-colors"
              min="1"
              step="0.1"
            />
          </div>
          <div className="flex items-center gap-2 bg-base/50 border border-white/10 rounded-lg px-3 py-1.5">
            <label className="text-[9px] text-ink-tertiary uppercase font-black tracking-widest">Min $Vol:</label>
            <input
              type="number"
              value={filters.minDollarVol / 1000000}
              onChange={(e) => setFilters(prev => ({ ...prev, minDollarVol: Number(e.target.value) * 1000000 }))}
              className="bg-white/5 text-white px-2 py-1 rounded text-xs w-14 data-font font-bold border border-white/10 focus:border-accent/50 focus:outline-none transition-colors"
              min="10"
              step="10"
            />
            <span className="text-[9px] text-ink-muted font-bold">M</span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-base/30 rounded-2xl border border-white/[0.05] overflow-hidden">
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-base/95 backdrop-blur-md z-10 border-b border-white/[0.08]">
              <tr>
                <th
                  className="text-left py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px] cursor-pointer hover:text-accent transition-colors"
                  onClick={() => handleSort('symbol')}
                >
                  Symbol {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px] cursor-pointer hover:text-accent transition-colors"
                  onClick={() => handleSort('price')}
                >
                  Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px] cursor-pointer hover:text-accent transition-colors"
                  onClick={() => handleSort('rvol')}
                >
                  RVOL {sortConfig.key === 'rvol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px] cursor-pointer hover:text-accent transition-colors"
                  onClick={() => handleSort('dollarVolume')}
                >
                  $Volume {sortConfig.key === 'dollarVolume' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px] cursor-pointer hover:text-accent transition-colors"
                  onClick={() => handleSort('changePercent')}
                >
                  %Δ {sortConfig.key === 'changePercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-center py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px]">Flow</th>
                <th className="text-left py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px]">Signal</th>
                <th className="text-center py-3 px-4 text-ink-tertiary font-black uppercase tracking-widest text-[9px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((stock, idx) => (
                <tr
                  key={stock.symbol}
                  className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-all cursor-pointer group"
                  onClick={() => handleStockClick(stock)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-accent/50 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="font-black text-white tracking-tight">{stock.symbol}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-white data-font font-bold">${stock.price?.toFixed(2) || '0.00'}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-black px-2 py-0.5 rounded ${stock.rvol >= 5 ? 'bg-negative/10 text-negative' :
                      stock.rvol >= 4 ? 'bg-warning/10 text-warning' :
                        stock.rvol >= 3 ? 'bg-accent/10 text-accent' : 'text-ink-secondary'
                      }`}>
                      {stock.rvol.toFixed(1)}x
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-white data-font font-bold">
                      ${(stock.dollarVolume / 1000000).toFixed(0)}M
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-black data-font ${stock.changePercent > 0 ? 'text-positive' :
                      stock.changePercent < 0 ? 'text-negative' : 'text-ink-muted'
                      }`}>
                      {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[8px] text-red-400/80 font-bold data-font">B:{stock.bidHits}%</span>
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: '100%',
                            background: `linear-gradient(to right, #ef4444 ${stock.bidHits}%, #22c55e ${stock.bidHits}%)`
                          }}
                        />
                      </div>
                      <span className="text-[8px] text-green-400/80 font-bold data-font">A:{stock.askHits}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-bold ${getActionColor(stock.action)}`}>
                      {stock.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Link
                      to={`/scanner/${stock.symbol}`}
                      className="inline-flex items-center px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Chart
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {volumeData.length === 0 && (
        <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
          <div className="p-4 bg-white/5 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-ink-muted" />
          </div>
          <p className="text-ink-tertiary text-sm font-semibold uppercase tracking-wider">{t('No stocks match')}</p>
        </div>
      )}
    </div>
  );
}
