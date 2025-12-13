import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Star, TrendingUp, TrendingDown, Plus, Trash2, Bell } from 'lucide-react';
import { useMarketStore } from '../stores/marketStore';
import { Link } from 'react-router-dom';

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  alertPrice?: number;
  notes?: string;
}

export function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { subscribedSymbols, addSubscribedSymbol, removeSubscribedSymbol } = useMarketStore();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  const fetchQuotes = async (items: WatchlistItem[]) => {
    if (items.length === 0) return;

    try {
      const symbols = items.map(i => i.symbol).join(',');
      const res = await fetch(`${API_URL}/api/quotes?symbols=${symbols}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');

      const data = await res.json();

      const updatedList = items.map(item => {
        const quoteData = data[item.symbol];
        if (!quoteData || !quoteData.quote) return item;

        const q = quoteData.quote;
        return {
          ...item,
          price: q.lastPrice || item.price,
          change: q.netChange || item.change,
          changePercent: q.netPercentChange || item.changePercent,
          volume: q.totalVolume || item.volume
        };
      });

      setWatchlist(updatedList);
      // Update local storage with fresh data (optional, but good for cache)
      localStorage.setItem('tapeReaderWatchlist', JSON.stringify(updatedList));

    } catch (err) {
      console.error('Error updating quotes:', err);
    }
  };

  useEffect(() => {
    // Load watchlist from localStorage
    const saved = localStorage.getItem('tapeReaderWatchlist');
    let initialList: WatchlistItem[] = [];

    if (saved) {
      initialList = JSON.parse(saved);
      setWatchlist(initialList);
    } else {
      // Default watchlist seeds - but fetches real data immediately
      initialList = [
        { symbol: 'SPY', name: 'SPDR S&P 500', price: 0, change: 0, changePercent: 0, volume: 0 },
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 0, change: 0, changePercent: 0, volume: 0 },
        { symbol: 'IWM', name: 'iShares Russell 2000', price: 0, change: 0, changePercent: 0, volume: 0 },
        { symbol: '$VIX', name: 'CBOE Volatility Index', price: 0, change: 0, changePercent: 0, volume: 0 },
        { symbol: 'MSFT', name: 'Microsoft Corp', price: 0, change: 0, changePercent: 0, volume: 0 }
      ];
      setWatchlist(initialList);
      localStorage.setItem('tapeReaderWatchlist', JSON.stringify(initialList));
    }

    // Initial fetch
    fetchQuotes(initialList);


  }, []); // Only on mount. 
  // Wait, if I use `watchlist` in dependency it will re-run polling every time list changes. That's fine.

  // Actually, let's separate polling to a different useEffect dependent on [watchlist]
  useEffect(() => {
    if (watchlist.length === 0) return;
    const interval = setInterval(() => fetchQuotes(watchlist), 5000);
    return () => clearInterval(interval);
  }, [watchlist.length]); // Re-setup when count changes, to capture new symbols. 
  // NOTE: If price changes, watchlist changes... infinite loop if we depend on full object.
  // Just depend on length or map of symbols.

  const saveWatchlist = (items: WatchlistItem[]) => {
    setWatchlist(items);
    localStorage.setItem('tapeReaderWatchlist', JSON.stringify(items));
  };

  const addToWatchlist = async () => {
    if (!newSymbol.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const symbol = newSymbol.trim().toUpperCase();

      // Check if already exists
      if (watchlist.some(i => i.symbol === symbol)) {
        setError('Symbol already in watchlist');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/quotes?symbols=${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch symbol data');

      const data = await res.json();
      const quoteData = data[symbol];

      if (!quoteData || !quoteData.quote) {
        throw new Error('Symbol not found');
      }

      const q = quoteData.quote;

      const newItem: WatchlistItem = {
        symbol: symbol,
        name: quoteData.quote.description || symbol,
        price: q.lastPrice || 0,
        change: q.netChange || 0,
        changePercent: q.netPercentChange || 0,
        volume: q.totalVolume || 0
      };

      const updated = [...watchlist, newItem];
      saveWatchlist(updated);
      addSubscribedSymbol(newItem.symbol);
      setNewSymbol('');
    } catch (error) {
      console.error('Error adding symbol:', error);
      setError('Invalid symbol or API error');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    const updated = watchlist.filter(item => item.symbol !== symbol);
    saveWatchlist(updated);
    removeSubscribedSymbol(symbol);
  };

  const setAlert = (symbol: string, alertPrice: number) => {
    const updated = watchlist.map(item =>
      item.symbol === symbol ? { ...item, alertPrice } : item
    );
    saveWatchlist(updated);
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
    return volume.toString();
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Watchlist</h1>
          <p className="text-gray-400">Track your favorite symbols and set price alerts</p>
        </div>

        {/* Add Symbol */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Plus className="h-5 w-5 mr-2 text-green-500" />
            Add Symbol to Watchlist
          </h2>
          <div className="flex space-x-4">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="Enter symbol (e.g., AAPL, TSLA)"
              className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              onKeyPress={(e) => e.key === 'Enter' && addToWatchlist()}
            />
            <button
              onClick={addToWatchlist}
              disabled={loading || !newSymbol.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-medium transition-colors flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Symbol
                </>
              )}
            </button>
          </div>
        </div>

        {/* Watchlist Table */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Star className="h-5 w-5 mr-2 text-yellow-500" />
            My Watchlist ({watchlist.length} symbols)
          </h2>

          {watchlist.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">Your watchlist is empty</p>
              <p className="text-gray-500 text-sm">Add some symbols to start tracking them</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Symbol</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Price</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Change</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Volume</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Alert</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map((item) => (
                    <tr key={item.symbol} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{item.symbol}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-300 text-sm">{item.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-semibold">{formatPrice(item.price)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`flex items-center ${item.change >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                          {item.change >= 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          <span>
                            {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
                            ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-300 text-sm">{formatVolume(item.volume)}</div>
                      </td>
                      <td className="py-3 px-4">
                        {item.alertPrice ? (
                          <div className="text-yellow-400 text-sm">
                            ${item.alertPrice.toFixed(2)}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              const alertPrice = prompt(`Set alert price for ${item.symbol} (current: ${formatPrice(item.price)}):`);
                              if (alertPrice) {
                                setAlert(item.symbol, parseFloat(alertPrice));
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                          >
                            Set Alert
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <Link
                            to={`/scanner/${item.symbol}`}
                            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                          >
                            Scanner
                          </Link>
                          <button
                            onClick={() => removeFromWatchlist(item.symbol)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {watchlist.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Gainers</div>
              <div className="text-green-400 font-bold text-lg">
                {watchlist.filter(item => item.change > 0).length}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Losers</div>
              <div className="text-red-400 font-bold text-lg">
                {watchlist.filter(item => item.change < 0).length}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Avg Change</div>
              <div className={`font-bold text-lg ${watchlist.reduce((sum, item) => sum + item.changePercent, 0) / watchlist.length >= 0
                ? 'text-green-400' : 'text-red-400'
                }`}>
                {(watchlist.reduce((sum, item) => sum + item.changePercent, 0) / watchlist.length).toFixed(2)}%
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Total Volume</div>
              <div className="text-white font-bold text-lg">
                {formatVolume(watchlist.reduce((sum, item) => sum + item.volume, 0))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}