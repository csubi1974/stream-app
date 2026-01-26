import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Shield, AlertTriangle, RefreshCw, ChevronRight, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface TradeLeg {
    action: 'BUY' | 'SELL';
    type: 'CALL' | 'PUT';
    strike: number;
    price: number;
    delta: number;
}

interface TradeAlert {
    id: string;
    strategy: 'BULL_PUT_SPREAD' | 'BEAR_CALL_SPREAD' | 'IRON_CONDOR';
    strategyLabel: string;
    underlying: string;
    expiration: string;
    legs: TradeLeg[];
    netCredit: number;
    maxLoss: number;
    maxProfit: number;
    probability: number;
    riskReward: string;
    rationale: string;
    status: 'ACTIVE' | 'WATCH' | 'CANCELLED' | 'EXPIRED';
    gexContext: {
        regime: string;
        callWall: number;
        putWall: number;
        gammaFlip: number;
        currentPrice: number;
        netDrift: number;
    };
    performance?: {
        currentPrice: number;
        unrealizedPnL: number;
        unrealizedPnLPercent: number;
        lastUpdated: string;
    };
}

export function TradeAlerts() {
    const { t } = useTranslation();
    const [alerts, setAlerts] = useState<TradeAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    const fetchAlerts = async () => {
        try {
            // Cache busting
            const response = await fetch(`/api/alerts/history?symbol=SPX&date=${new Date().toISOString().split('T')[0]}&_t=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.alerts) {
                console.log('🔔 Alerts received:', data.alerts);
                setAlerts(data.alerts);
                setLastUpdate(new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('❌ Failed to fetch trade alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true); // Initial loading state
        fetchAlerts();
        // Refresh every 30 seconds for live PnL updates
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStrategyIcon = (strategy: string) => {
        switch (strategy) {
            case 'BULL_PUT_SPREAD':
                return <TrendingUp className="h-5 w-5 text-green-400" />;
            case 'BEAR_CALL_SPREAD':
                return <TrendingDown className="h-5 w-5 text-red-400" />;
            case 'IRON_CONDOR':
                return <Shield className="h-5 w-5 text-purple-400" />;
            default:
                return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded-full font-medium">🟢 Activa</span>;
            case 'WATCH':
                return <span className="px-2 py-0.5 bg-yellow-900 text-yellow-300 text-xs rounded-full font-medium">🟡 Vigilar</span>;
            case 'CANCELLED':
                return <span className="px-2 py-0.5 bg-red-900 text-red-300 text-xs rounded-full font-medium">🔴 Cancelada</span>;
            case 'EXPIRED':
                return <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full font-medium">⏰ Expirada</span>;
            default:
                return null;
        }
    };

    const getStrategyColor = (strategy: string) => {
        switch (strategy) {
            case 'BULL_PUT_SPREAD':
                return 'border-green-500/30 hover:border-green-500/50';
            case 'BEAR_CALL_SPREAD':
                return 'border-red-500/30 hover:border-red-500/50';
            case 'IRON_CONDOR':
                return 'border-purple-500/30 hover:border-purple-500/50';
            default:
                return 'border-gray-700';
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg">
                        <Zap className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">{t('Stream Trade Signals')}</h2>
                        <p className="text-xs text-gray-400">{t('Estrategias activas y rendimiento')}</p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    {lastUpdate && (
                        <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {lastUpdate}
                        </span>
                    )}
                    <button
                        onClick={fetchAlerts}
                        disabled={loading}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Alerts Grid */}
            {loading && alerts.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-400">{t('Cargando señales...')}</span>
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">{t('No hay alertas activas hoy')}</p>
                    <p className="text-xs text-gray-500 mt-2">{t('Las alertas aparecen cuando se detectan condiciones de alta probabilidad')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`bg-gray-900 rounded-xl p-5 border transition-all ${getStrategyColor(alert.strategy)}`}
                        >
                            {/* Alert Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    {getStrategyIcon(alert.strategy)}
                                    <div>
                                        <h3 className="text-white font-bold">{alert.strategyLabel}</h3>
                                        <span className="text-xs text-gray-400">{alert.underlying} • Exp: {alert.expiration}</span>
                                    </div>
                                </div>
                                {getStatusBadge(alert.status)}
                            </div>

                            {/* Legs Table */}
                            {alert.legs.length > 0 && (
                                <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-500 text-xs uppercase">
                                                <th className="text-left pb-2">{t('Acción')}</th>
                                                <th className="text-left pb-2">{t('Tipo')}</th>
                                                <th className="text-right pb-2">{t('Strike')}</th>
                                                <th className="text-center pb-2">{t('Estado')}</th>
                                                <th className="text-right pb-2">{t('Precio')}</th>
                                                <th className="text-right pb-2">Δ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {alert.legs.map((leg, i) => {
                                                const isITM = leg.type === 'CALL'
                                                    ? alert.gexContext.currentPrice > leg.strike
                                                    : alert.gexContext.currentPrice < leg.strike;

                                                return (
                                                    <tr key={i} className="border-t border-gray-700">
                                                        <td className={`py-2 font-medium ${leg.action === 'SELL' ? 'text-red-400' : 'text-green-400'}`}>
                                                            {leg.action}
                                                        </td>
                                                        <td className="py-2 text-gray-300">{leg.type}</td>
                                                        <td className="py-2 text-right text-white font-mono">${leg.strike.toFixed(0)}</td>
                                                        <td className="py-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isITM
                                                                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                                    : 'bg-green-500/20 text-green-400 border-green-500/30'
                                                                }`}>
                                                                {isITM ? 'ITM' : 'OTM'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-right text-gray-300">${leg.price.toFixed(2)}</td>
                                                        <td className="py-2 text-right text-gray-400">{leg.delta.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Performance Board (NEW) */}
                            {alert.performance ? (
                                <div className="mb-4 bg-black/40 rounded-lg p-4 border border-gray-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs text-gray-400 uppercase font-bold tracking-wider flex items-center">
                                            <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                                            {t('Live Performance')}
                                        </div>
                                        <div className="text-[10px] text-gray-600 font-mono">
                                            Last: {new Date(alert.performance.lastUpdated).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase">{t('Unrealized PnL')}</div>
                                            <div className={`text-lg font-mono font-bold ${alert.performance.unrealizedPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {alert.performance.unrealizedPnL > 0 ? '+' : ''}${alert.performance.unrealizedPnL.toFixed(0)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase">{t('Return (ROI)')}</div>
                                            <div className={`text-lg font-mono font-bold ${alert.performance.unrealizedPnLPercent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {alert.performance.unrealizedPnLPercent > 0 ? '+' : ''}{alert.performance.unrealizedPnLPercent.toFixed(1)}%
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-500 uppercase">{t('Start Value')}</div>
                                            <div className="text-lg font-mono font-bold text-white">
                                                ${alert.performance.currentPrice.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4 bg-gray-800/30 rounded-lg p-4 border border-dashed border-gray-700 text-center">
                                    <span className="text-xs text-gray-500 flex items-center justify-center">
                                        <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                        {t('Waiting for Real-Time PnL...')}
                                    </span>
                                </div>
                            )}

                            {/* Static Metrics Row */}
                            <div className="grid grid-cols-4 gap-4 mb-4 opacity-75 grayscale hover:filter-none hover:opacity-100 transition-all">
                                <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('Entry Credit')}</div>
                                    <div className="text-green-400 font-bold text-sm">${alert.netCredit.toFixed(2)}</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('Max Risk')}</div>
                                    <div className="text-red-400 font-bold text-sm">${alert.maxLoss.toFixed(2)}</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('Prob. Win')}</div>
                                    <div className="text-blue-400 font-bold text-sm">{alert.probability}%</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('R:R')}</div>
                                    <div className="text-purple-400 font-bold text-sm">{alert.riskReward}</div>
                                </div>
                            </div>

                            {/* Rationale */}
                            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 mb-4">
                                <p className="text-sm text-blue-200">
                                    <span className="font-bold text-blue-400">⚡ Contexto GEX:</span> {alert.rationale}
                                </p>
                            </div>

                            {/* GEX Context Mini-HUD */}
                            <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700 pt-3">
                                <div className="flex space-x-4">
                                    <span>Régimen: <span className={`font-medium ${alert.gexContext.regime === 'stable' ? 'text-green-400' : 'text-red-400'}`}>{alert.gexContext.regime}</span></span>
                                    <span>Drift: <span className={`font-medium ${alert.gexContext.netDrift > 0 ? 'text-green-400' : 'text-red-400'}`}>{alert.gexContext.netDrift.toFixed(2)}</span></span>
                                    <span>Spot: <span className="text-white">${alert.gexContext.currentPrice.toFixed(2)}</span></span>
                                </div>
                                <Link
                                    to={`/ladder/${alert.underlying}`}
                                    className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {t('Ver Ladder')}
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
