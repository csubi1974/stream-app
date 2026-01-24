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
    generatedAt: string;
}

export function TradeAlerts() {
    const { t } = useTranslation();
    const [alerts, setAlerts] = useState<TradeAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/alerts/strategies?symbol=SPX');
            const data = await response.json();

            if (data.success && data.alerts) {
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
        fetchAlerts();
        // Refresh every 5 minutes during market hours
        const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
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
                        <p className="text-xs text-gray-400">{t('Estrategias generadas por el motor GEX')}</p>
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
                    <span className="ml-3 text-gray-400">{t('Analizando condiciones de mercado...')}</span>
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">{t('No hay alertas disponibles')}</p>
                    <p className="text-xs text-gray-500 mt-2">{t('Las alertas se generan durante horario de mercado')}</p>
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
                                                <th className="text-right pb-2">{t('Precio')}</th>
                                                <th className="text-right pb-2">Δ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {alert.legs.map((leg, i) => (
                                                <tr key={i} className="border-t border-gray-700">
                                                    <td className={`py-2 font-medium ${leg.action === 'SELL' ? 'text-red-400' : 'text-green-400'}`}>
                                                        {leg.action}
                                                    </td>
                                                    <td className="py-2 text-gray-300">{leg.type}</td>
                                                    <td className="py-2 text-right text-white font-mono">${leg.strike.toFixed(0)}</td>
                                                    <td className="py-2 text-right text-gray-300">${leg.price.toFixed(2)}</td>
                                                    <td className="py-2 text-right text-gray-400">{leg.delta.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Metrics Row */}
                            <div className="grid grid-cols-4 gap-4 mb-4">
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-xs text-gray-500 uppercase mb-1">{t('Crédito')}</div>
                                    <div className="text-green-400 font-bold">${alert.netCredit.toFixed(2)}</div>
                                    <div className="text-xs text-gray-500">${(alert.netCredit * 100).toFixed(0)}</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-xs text-gray-500 uppercase mb-1">{t('Max Loss')}</div>
                                    <div className="text-red-400 font-bold">${alert.maxLoss.toFixed(2)}</div>
                                    <div className="text-xs text-gray-500">${(alert.maxLoss * 100).toFixed(0)}</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-xs text-gray-500 uppercase mb-1">{t('Prob. Profit')}</div>
                                    <div className="text-blue-400 font-bold">{alert.probability}%</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-xs text-gray-500 uppercase mb-1">{t('R:R')}</div>
                                    <div className="text-purple-400 font-bold">{alert.riskReward}</div>
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
