import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Calendar as CalendarIcon, TrendingUp, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EconomicEvent {
    id: string;
    date: string;
    time: string;
    event: string;
    country: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    actual?: string;
    forecast?: string;
    previous?: string;
    isLive?: boolean;
}

interface NewsItem {
    id: string;
    headline: string;
    source: string;
    timestamp: string;
    url?: string;
}

type TabType = 'today' | 'week' | 'next-week';

export function Calendar() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('today');
    const [events, setEvents] = useState<EconomicEvent[]>([]);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [impactFilter, setImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch economic events
            const endpoint = activeTab === 'today' ? '/api/calendar/today' :
                activeTab === 'week' ? '/api/calendar/week' :
                    '/api/calendar/next-week';

            const eventsResponse = await fetch(endpoint);
            const eventsData = await eventsResponse.json();
            setEvents(eventsData.events || []);

            // Fetch news
            const newsResponse = await fetch('/api/calendar/news?limit=10');
            const newsData = await newsResponse.json();
            setNews(newsData.news || []);

            setLastUpdate(new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Failed to fetch calendar data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'HIGH': return 'text-red-400';
            case 'MEDIUM': return 'text-yellow-400';
            case 'LOW': return 'text-green-400';
            default: return 'text-gray-400';
        }
    };

    const getImpactDots = (impact: string) => {
        switch (impact) {
            case 'HIGH': return '🔴🔴🔴';
            case 'MEDIUM': return '🟡🟡';
            case 'LOW': return '🟢';
            default: return '⚪';
        }
    };

    const getCountryFlag = (country: string) => {
        const flags: Record<string, string> = {
            'US': '🇺🇸',
            'EU': '🇪🇺',
            'UK': '🇬🇧',
            'JP': '🇯🇵',
            'CN': '🇨🇳',
            'CA': '🇨🇦',
            'AU': '🇦🇺'
        };
        return flags[country] || '🌐';
    };

    const getRelativeTime = (timestamp: string) => {
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    return (
        <div className="min-h-screen bg-gray-900">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30">
                                <CalendarIcon className="h-8 w-8 text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">{t('Market Calendar & News')}</h1>
                                <p className="text-gray-400">{t('Economic events and market-moving headlines')}</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-5 w-5 text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Tabs & Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex space-x-2">
                        {[
                            { id: 'today' as TabType, label: t('Today') },
                            { id: 'week' as TabType, label: t('This Week') },
                            { id: 'next-week' as TabType, label: t('Next Week') }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center space-x-2 bg-gray-800 p-1 rounded-xl border border-gray-700">
                        {[
                            { id: 'ALL', label: t('All'), color: 'text-white' },
                            { id: 'HIGH', label: '🔴', color: 'bg-red-500/20 text-red-500' },
                            { id: 'MEDIUM', label: '🟡', color: 'bg-yellow-500/20 text-yellow-500' },
                            { id: 'LOW', label: '🟢', color: 'bg-green-500/20 text-green-500' }
                        ].map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setImpactFilter(filter.id as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${impactFilter === filter.id
                                    ? 'bg-gray-700 text-white border border-gray-600'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                title={filter.id === 'ALL' ? t('Show All') : `${t('Filter by')} ${filter.id}`}
                            >
                                <span className="flex items-center space-x-1">
                                    <span>{filter.label}</span>
                                    {filter.id === 'ALL' && <span>{t('Impact')}</span>}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Economic Calendar */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800 rounded-lg border border-gray-700">
                            <div className="p-4 border-b border-gray-700">
                                <h2 className="text-lg font-bold text-white">{t('Economic Calendar')}</h2>
                            </div>

                            <div className="divide-y divide-gray-700">
                                {loading && events.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                                        <p className="text-gray-400 mt-4">{t('Loading events...')}</p>
                                    </div>
                                ) : events.filter(e => impactFilter === 'ALL' || e.impact === impactFilter).length === 0 ? (
                                    <div className="p-8 text-center">
                                        <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                        <p className="text-gray-400">{t('No events found for this impact level')}</p>
                                    </div>
                                ) : (
                                    events
                                        .filter(e => impactFilter === 'ALL' || e.impact === impactFilter)
                                        .map(event => (
                                            <div
                                                key={event.id}
                                                className={`p-4 hover:bg-gray-700/50 transition-colors ${event.isLive ? 'bg-red-900/20 border-l-4 border-l-red-500' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start space-x-4">
                                                    {/* Time & Date */}
                                                    <div className="flex-shrink-0 w-24">
                                                        <div className="text-xs text-gray-500 font-bold mb-1">{event.date}</div>
                                                        <div className="text-sm font-mono text-gray-300">{event.time} ET</div>
                                                        {event.isLive && (
                                                            <div className="text-xs text-red-400 font-bold animate-pulse mt-1">
                                                                LIVE NOW
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Event Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <span className="text-2xl">{getCountryFlag(event.country)}</span>
                                                            <h3 className="text-white font-semibold">{event.event}</h3>
                                                            {event.impact === 'HIGH' && (
                                                                <span className="px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded-full font-bold">
                                                                    HIGH IMPACT
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Data */}
                                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                                            <div>
                                                                <div className="text-gray-500 text-xs">Real</div>
                                                                <div className="text-green-400 font-mono font-bold">
                                                                    {event.actual || '--'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-500 text-xs">Forecast</div>
                                                                <div className="text-gray-300 font-mono">
                                                                    {event.forecast || '--'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-500 text-xs">Previous</div>
                                                                <div className="text-gray-400 font-mono">
                                                                    {event.previous || '--'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Impact Indicator */}
                                                    <div className="flex-shrink-0">
                                                        <div className="text-2xl">{getImpactDots(event.impact)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* News Feed */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 rounded-lg border border-gray-700">
                            <div className="p-4 border-b border-gray-700">
                                <h2 className="text-lg font-bold text-white">{t('Live News Feed')}</h2>
                            </div>

                            <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
                                {news.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                        <p className="text-gray-400 font-medium mb-2">{t('No news sources connected')}</p>
                                        <p className="text-xs text-gray-500 max-w-[200px] mx-auto">
                                            {t('Connect your Schwab account to receive live market news, or add an external feed.')}
                                        </p>
                                    </div>
                                ) : (
                                    news.map((item, index) => (
                                        <div
                                            key={index}
                                            className="p-4 hover:bg-gray-700/50 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-start space-x-3">
                                                <div className="flex-shrink-0 mt-1">
                                                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                                                        <TrendingUp className="h-4 w-4 text-blue-400" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-gray-500 mb-1">
                                                        {getRelativeTime(item.timestamp)} • {item.source}
                                                    </div>
                                                    <p className="text-sm text-white leading-relaxed">
                                                        {item.headline}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Last Update */}
                        {lastUpdate && (
                            <div className="mt-4 text-center text-xs text-gray-500">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {t('Last updated')}: {lastUpdate}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
