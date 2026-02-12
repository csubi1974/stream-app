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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Market Bias */}
            <div className="glass-surface rounded-2xl p-5 border border-white/[0.08] hover:border-white/[0.15] transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] text-ink-tertiary uppercase font-black tracking-[0.2em]">{t('Market Bias')}</span>
                    <div className={`p-2 rounded-lg ${marketTrend.color.includes('green') ? 'bg-green-500/10' : marketTrend.color.includes('red') ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
                        <TrendingUp className={`h-4 w-4 ${marketTrend.color}`} />
                    </div>
                </div>
                <div className={`text-3xl font-black ${marketTrend.color} mb-2 tracking-tight`}>{marketTrend.label}</div>
                <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">{t('Based on SPY & QQQ')}</div>
                <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${marketTrend.color.includes('green') ? 'bg-green-400' : marketTrend.color.includes('red') ? 'bg-red-400' : 'bg-yellow-400'} transition-all`} style={{ width: '60%' }}></div>
                </div>
            </div>

            {/* High RVOL */}
            <div className="glass-surface rounded-2xl p-5 border border-white/[0.08] hover:border-accent/20 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all"></div>
                <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[9px] text-ink-tertiary uppercase font-black tracking-[0.2em]">{t('High RVOL Stocks')}</span>
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <BarChart3 className="h-4 w-4 text-blue-400" />
                        </div>
                    </div>
                    <div className="text-white text-4xl font-black mb-2 data-font tracking-tighter">{highRvolCount}</div>
                    <div className="text-[10px] text-blue-400 uppercase tracking-wider font-bold">{t('> 3.0x Relative Vol')}</div>
                </div>
            </div>

            {/* Breadth */}
            <div className="glass-surface rounded-2xl p-5 border border-white/[0.08] hover:border-warning/20 transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] text-ink-tertiary uppercase font-black tracking-[0.2em]">{t('Market Breadth')}</span>
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Activity className="h-4 w-4 text-orange-400" />
                    </div>
                </div>
                <div className="flex items-baseline space-x-3 mb-2">
                    <div className="flex flex-col">
                        <span className="text-green-400 text-3xl font-black data-font leading-none">{gainers}</span>
                        <span className="text-[8px] text-green-400/60 uppercase font-bold tracking-widest mt-1">UP</span>
                    </div>
                    <span className="text-ink-muted text-2xl font-light">/</span>
                    <div className="flex flex-col">
                        <span className="text-red-400 text-3xl font-black data-font leading-none">{losers}</span>
                        <span className="text-[8px] text-red-400/60 uppercase font-bold tracking-widest mt-1">DOWN</span>
                    </div>
                </div>
                <div className="flex gap-1 mt-3">
                    <div className="flex-1 h-1.5 bg-green-500/20 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400" style={{ width: `${(gainers / (gainers + losers)) * 100}%` }}></div>
                    </div>
                    <div className="flex-1 h-1.5 bg-red-500/20 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400" style={{ width: `${(losers / (gainers + losers)) * 100}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Money Flow */}
            <div className="glass-surface rounded-2xl p-5 border border-white/[0.08] hover:border-purple-400/20 transition-all group relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-purple-500/5 to-transparent"></div>
                <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[9px] text-ink-tertiary uppercase font-black tracking-[0.2em]">{t('Money Flow')}</span>
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-purple-400" />
                        </div>
                    </div>
                    <div className="flex items-baseline space-x-2 mb-2">
                        <span className="text-white text-4xl font-black data-font tracking-tighter">{buyPressure.toFixed(0)}</span>
                        <span className="text-purple-400 text-2xl font-bold">%</span>
                    </div>
                    <div className="text-[10px] text-purple-400/80 uppercase tracking-wider font-bold">{t('$Vol into Green Stocks')}</div>
                    <div className="mt-4 relative h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-negative via-warning to-positive"></div>
                        <div className="absolute inset-0 bg-base" style={{ width: `${100 - buyPressure}%`, marginLeft: `${buyPressure}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
