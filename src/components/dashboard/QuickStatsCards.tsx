import { TrendingUp, BarChart3, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore } from '../../stores/marketStore';

export function QuickStatsCards() {
    const { t } = useTranslation();
    const { volumeData } = useMarketStore();

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
            <div className="bg-gray-800 rounded-lg p-4 bg-opacity-50">
                <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    <span className="text-gray-400 text-sm">{t('High RVOL Stocks')}</span>
                </div>
                <div className="text-white text-2xl font-bold">{highRvolCount}</div>
                <div className="text-blue-400 text-xs">{t('> 3.0x Relative Vol')}</div>
            </div>

            {/* Breadth */}
            <div className="bg-gray-800 rounded-lg p-4 bg-opacity-50">
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
            <div className="bg-gray-800 rounded-lg p-4 bg-opacity-50">
                <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    <span className="text-gray-400 text-sm">{t('Money Flow')}</span>
                </div>
                <div className="text-white text-2xl font-bold">{buyPressure.toFixed(0)}%</div>
                <div className="text-purple-400 text-xs">{t('$Vol into Green Stocks')}</div>
            </div>
        </div>
    );
}
