
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { VolumeScanner } from '../components/dashboard/VolumeScanner';
import { ArrowLeft, TrendingUp, BarChart3, AlertTriangle, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore } from '../stores/marketStore';
import { CandleChart } from '../components/charts/CandleChart';

export function SwingScanner() {
  const { t } = useTranslation();
  const { symbol } = useParams<{ symbol: string }>();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(symbol || null);
  const { volumeData } = useMarketStore();

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  // Calculate Real-Time Market Stats
  const spy = volumeData.find(s => s.symbol === 'SPY');
  const qqq = volumeData.find(s => s.symbol === 'QQQ');

  const marketTrend = (() => {
    if (!spy || !qqq) return { label: t('Wait'), color: 'text-gray-400' };
    const spyChg = spy.changePercent;
    const qqqChg = qqq.changePercent;

    if (spyChg > 0.2 && qqqChg > 0.2) return { label: t('Bullish'), color: 'text-green-400' };
    if (spyChg < -0.2 && qqqChg < -0.2) return { label: t('Bearish'), color: 'text-red-400' };
    if (spyChg > 0 && qqqChg > 0) return { label: t('Mild Bull'), color: 'text-green-300' };
    if (spyChg < 0 && qqqChg < 0) return { label: t('Mild Bear'), color: 'text-red-300' };
    return { label: t('Choppy'), color: 'text-yellow-400' };
  })();

  const highRvolCount = volumeData.filter(s => s.rvol > 3).length;
  const gainers = volumeData.filter(s => s.changePercent > 0).length;
  const losers = volumeData.length - gainers;

  const totalVolume = volumeData.reduce((acc, curr) => acc + curr.dollarVolume, 0);
  const greenVolume = volumeData.filter(s => s.changePercent > 0).reduce((acc, curr) => acc + curr.dollarVolume, 0);
  const buyPressure = totalVolume > 0 ? (greenVolume / totalVolume) * 100 : 50;

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('Swing Scanner')}</h1>
              <p className="text-gray-400">{t('Real-time bias')}</p>
            </div>
          </div>

          {selectedSymbol && (
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400">{t('Selected')}</div>
              <div className="text-white font-bold">{selectedSymbol}</div>
            </div>
          )}
        </div>

        {/* Quick Stats - LIVE DATA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Market Bias */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className={`h-5 w-5 ${marketTrend.color}`} />
              <span className="text-gray-400 text-sm">{t('Market Bias')}</span>
            </div>
            <div className={`text-2xl font-bold ${marketTrend.color}`}>{marketTrend.label}</div>
            <div className="text-gray-400 text-xs">{t('Based on SPY & QQQ')}</div>
          </div>

          {/* High RVOL */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span className="text-gray-400 text-sm">{t('High RVOL Stocks')}</span>
            </div>
            <div className="text-white text-2xl font-bold">{highRvolCount}</div>
            <div className="text-blue-400 text-xs">{t('> 3.0x Relative Vol')}</div>
          </div>

          {/* Breadth */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="h-5 w-5 text-yellow-500" />
              <span className="text-gray-400 text-sm">{t('Market Breadth')}</span>
            </div>
            <div className="flex items-end space-x-2">
              <span className="text-green-400 text-2xl font-bold">{gainers}</span>
              <span className="text-gray-500 text-lg">/</span>
              <span className="text-red-400 text-2xl font-bold">{losers}</span>
            </div>
            <div className="text-yellow-400 text-xs">{t('Gainers vs Losers')}</div>
          </div>

          {/* Sentiment / Flow */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <span className="text-gray-400 text-sm">{t('Money Flow')}</span>
            </div>
            <div className="text-white text-2xl font-bold">{buyPressure.toFixed(0)}%</div>
            <div className="text-purple-400 text-xs">{t('$Vol into Green Stocks')}</div>
          </div>
        </div>

        {selectedSymbol && (
          <div className="mb-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{selectedSymbol} {t('- Quick Analysis')}</h3>
              <div className="flex space-x-2">
                <Link
                  to={`/ladder/${selectedSymbol}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  {t('View Ladder')}
                </Link>
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors">
                  {t('Add to Watchlist')}
                </button>
              </div>
            </div>

            {/* Chart */}
            <div className="mb-6 h-[400px]">
              <CandleChart
                key={selectedSymbol}
                symbol={selectedSymbol}
                currentPrice={volumeData.find(s => s.symbol === selectedSymbol)?.price}
              />
            </div>

            {(() => {
              const stock = volumeData.find(s => s.symbol === selectedSymbol);
              if (!stock) return <p className="text-gray-400">{t('Loading stats...')}</p>;

              // Approximations for missing data
              const avgVol = stock.rvol > 0 ? (stock.dollarVolume / stock.price) / stock.rvol : 0;

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-gray-400 text-sm mb-2">{t('Volume Analysis')}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('Current Volume')}:</span>
                        <span className="text-white">{(stock.dollarVolume / stock.price / 1000000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('Avg Volume')}:</span>
                        <span className="text-white">{(avgVol / 1000000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('RVOL')}:</span>
                        <span className={`font-bold ${stock.rvol > 3 ? 'text-red-400' : 'text-green-400'}`}>{stock.rvol.toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-gray-400 text-sm mb-2">{t('Price Action')}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('Current Price')}:</span>
                        <span className="text-white">${stock.price != null ? stock.price.toFixed(2) : '--'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('Change')}:</span>
                        <span className={`font-bold ${stock.changePercent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('Dollar Vol')}:</span>
                        <span className="text-blue-400">${(stock.dollarVolume / 1000000).toFixed(0)}M</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-gray-400 text-sm mb-2">{t('Flow Signals')}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('Buy Pressure')}:</span>
                        <span className="text-green-400 font-bold">{stock.askHits}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('Trend')}:</span>
                        <span className={`font-bold ${stock.changePercent > 1 ? 'text-green-400' : stock.changePercent < -1 ? 'text-red-400' : 'text-yellow-400'}`}>
                          {stock.action}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}



        {/* Main Scanner */}
        <VolumeScanner onSymbolSelect={handleSymbolSelect} />



        {/* Scanner Tips */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-semibold mb-2">{t('Scanner Tips')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <strong className="text-green-400">{t('High RVOL Tip Title')}</strong> {t('High RVOL Tip Body')}
            </div>
            <div>
              <strong className="text-blue-400">{t('VWAP Tip Title')}</strong> {t('VWAP Tip Body')}
            </div>
            <div>
              <strong className="text-yellow-400">{t('CVD Tip Title')}</strong> {t('CVD Tip Body')}
            </div>
            <div>
              <strong className="text-purple-400">{t('Buy Pressure Tip Title')}</strong> {t('Buy Pressure Tip Body')}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}