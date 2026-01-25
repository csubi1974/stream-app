import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import {
    Zap, TrendingUp, TrendingDown, Shield, AlertTriangle,
    RefreshCw, Filter, Clock, CheckCircle, XCircle, Eye,
    ChevronRight, BarChart3
} from 'lucide-react';
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
        expectedMove?: number;
    };
    generatedAt: string;
    // Quality Scoring (NEW)
    qualityScore?: number;
    qualityLevel?: 'PREMIUM' | 'STANDARD' | 'AGGRESSIVE';
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    qualityFactors?: {
        moveExhaustion: number;
        expectedMoveUsage: number;
        wallProximity: number;
        timeRemaining: number;
        regimeStrength: number;
        driftAlignment: number;
    };
    metadata?: {
        openPrice: number;
        moveFromOpen: number;
        movePercent: number;
        moveRatio: number;
        wallDistance: number;
        hoursRemaining: number;
        generatedAtPrice: number;
    };
}

export function Signals() {
    const { t } = useTranslation();
    const [alerts, setAlerts] = useState<TradeAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    // Filters & Mode
    const [viewMode, setViewMode] = useState<'LIVE' | 'HISTORY'>('LIVE');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [filterStrategy, setFilterStrategy] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
    const [minProbability, setMinProbability] = useState<number>(70);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const endpoint = viewMode === 'LIVE'
                ? '/api/alerts/strategies?symbol=SPX'
                : `/api/alerts/history?symbol=SPX&date=${selectedDate}`;

            const response = await fetch(endpoint);
            const data = await response.json();

            if (data.success && data.alerts) {
                setAlerts(data.alerts);
                setLastUpdate(new Date().toLocaleTimeString());
            } else {
                setAlerts([]);
            }
        } catch (error) {
            console.error('❌ Failed to fetch trade alerts:', error);
            setAlerts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();

        // Only auto-refresh in LIVE mode
        let interval: NodeJS.Timeout | null = null;
        if (viewMode === 'LIVE') {
            interval = setInterval(fetchAlerts, 5 * 60 * 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [viewMode, selectedDate]);

    // Apply filters
    const filteredAlerts = alerts.filter(alert => {
        if (filterStrategy !== 'ALL' && alert.strategy !== filterStrategy) return false;
        if (filterStatus !== 'ALL' && alert.status !== filterStatus) return false;
        if (alert.probability < minProbability) return false;
        return true;
    });

    const getStrategyIcon = (strategy: string) => {
        switch (strategy) {
            case 'BULL_PUT_SPREAD':
                return <TrendingUp className="h-5 w-5" />;
            case 'BEAR_CALL_SPREAD':
                return <TrendingDown className="h-5 w-5" />;
            case 'IRON_CONDOR':
                return <Shield className="h-5 w-5" />;
            default:
                return <AlertTriangle className="h-5 w-5" />;
        }
    };

    const getStrategyColor = (strategy: string) => {
        switch (strategy) {
            case 'BULL_PUT_SPREAD':
                return 'border-green-500/30 hover:border-green-500/50 bg-green-900/5';
            case 'BEAR_CALL_SPREAD':
                return 'border-red-500/30 hover:border-red-500/50 bg-red-900/5';
            case 'IRON_CONDOR':
                return 'border-purple-500/30 hover:border-purple-500/50 bg-purple-900/5';
            default:
                return 'border-gray-700';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <span className="inline-flex items-center px-3 py-1 bg-green-900/30 text-green-300 text-xs rounded-full font-medium border border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('Activa')}
                    </span>
                );
            case 'WATCH':
                return (
                    <span className="inline-flex items-center px-3 py-1 bg-yellow-900/30 text-yellow-300 text-xs rounded-full font-medium border border-yellow-500/30">
                        <Eye className="h-3 w-3 mr-1" />
                        {t('Vigilar')}
                    </span>
                );
            case 'CANCELLED':
                return (
                    <span className="inline-flex items-center px-3 py-1 bg-red-900/30 text-red-300 text-xs rounded-full font-medium border border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        {t('Cancelada')}
                    </span>
                );
            default:
                return null;
        }
    };

    const getQualityBadge = (qualityLevel?: string, qualityScore?: number) => {
        if (!qualityLevel || qualityScore === undefined) return null;

        switch (qualityLevel) {
            case 'PREMIUM':
                return (
                    <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs rounded-full font-bold shadow-lg">
                        ✨ PREMIUM {qualityScore}
                    </span>
                );
            case 'STANDARD':
                return (
                    <span className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-bold">
                        👍 STANDARD {qualityScore}
                    </span>
                );
            case 'AGGRESSIVE':
                return (
                    <span className="inline-flex items-center px-3 py-1 bg-orange-600 text-white text-xs rounded-full font-bold">
                        ⚠️ AGGRESSIVE {qualityScore}
                    </span>
                );
            default:
                return null;
        }
    };

    const getRiskBadge = (riskLevel?: string) => {
        if (!riskLevel) return null;

        switch (riskLevel) {
            case 'LOW':
                return (
                    <span className="inline-flex items-center px-2 py-1 bg-green-900/40 text-green-300 text-xs rounded font-medium">
                        🟢 LOW RISK
                    </span>
                );
            case 'MEDIUM':
                return (
                    <span className="inline-flex items-center px-2 py-1 bg-yellow-900/40 text-yellow-300 text-xs rounded font-medium">
                        🟡 MEDIUM RISK
                    </span>
                );
            case 'HIGH':
                return (
                    <span className="inline-flex items-center px-2 py-1 bg-red-900/40 text-red-300 text-xs rounded font-medium">
                        🔴 HIGH RISK
                    </span>
                );
            default:
                return null;
        }
    };

    const stats = {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'ACTIVE').length,
        avgProbability: alerts.length > 0
            ? (alerts.reduce((sum, a) => sum + a.probability, 0) / alerts.length).toFixed(1)
            : 0
    };

    return (
        <div className="min-h-screen bg-gray-900">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30">
                            <Zap className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">{t('Stream Trade Signals')}</h1>
                            <p className="text-gray-400">
                                {viewMode === 'LIVE'
                                    ? t('Estrategias generadas por el motor GEX en tiempo real')
                                    : t('Historial de señales registradas en el motor GEX')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex space-x-2 mb-6">
                    <button
                        onClick={() => setViewMode('LIVE')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'LIVE'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {t('En Vivo')}
                    </button>
                    <button
                        onClick={() => setViewMode('HISTORY')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'HISTORY'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {t('Historial')}
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-400 text-sm">{t('Total Señales')}</div>
                                <div className="text-2xl font-bold text-white">{stats.total}</div>
                            </div>
                            <BarChart3 className="h-8 w-8 text-blue-500" />
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-400 text-sm">{t('Activas')}</div>
                                <div className="text-2xl font-bold text-green-400">{stats.active}</div>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-400 text-sm">{t('Prob. Promedio')}</div>
                                <div className="text-2xl font-bold text-blue-400">{stats.avgProbability}%</div>
                            </div>
                            <TrendingUp className="h-8 w-8 text-blue-500" />
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-400 text-sm">{t('Mov. Esperado')}</div>
                                <div className="text-2xl font-bold text-purple-400">
                                    {alerts.length > 0 && alerts[0].gexContext.expectedMove
                                        ? `±$${alerts[0].gexContext.expectedMove.toFixed(1)}`
                                        : '--'
                                    }
                                </div>
                                {alerts.length > 0 && alerts[0].gexContext.expectedMove && alerts[0].gexContext.currentPrice > 0 && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        {((alerts[0].gexContext.expectedMove / alerts[0].gexContext.currentPrice) * 100).toFixed(2)}%
                                    </div>
                                )}
                            </div>
                            <TrendingUp className="h-8 w-8 text-purple-500" />
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-400 text-sm">{t('Última Actualización')}</div>
                                <div className="text-sm font-medium text-white">{lastUpdate || '--:--'}</div>
                            </div>
                            <button
                                onClick={fetchAlerts}
                                disabled={loading}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`h-5 w-5 text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-8">
                    <div className="flex items-center space-x-2 mb-4">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-300">{t('Filtros')}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {viewMode === 'HISTORY' && (
                            <div>
                                <label className="block text-xs text-gray-400 mb-2">{t('Fecha')}</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        )}
                        <div className={viewMode === 'LIVE' ? 'col-span-1' : ''}>
                            <label className="block text-xs text-gray-400 mb-2">{t('Estrategia')}</label>
                            <select
                                value={filterStrategy}
                                onChange={(e) => setFilterStrategy(e.target.value)}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                            >
                                <option value="ALL">{t('Todas')}</option>
                                <option value="BULL_PUT_SPREAD">{t('Bull Put Spread')}</option>
                                <option value="BEAR_CALL_SPREAD">{t('Bear Call Spread')}</option>
                                <option value="IRON_CONDOR">{t('Iron Condor')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2">{t('Estado')}</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                            >
                                <option value="ALL">{t('Todos')}</option>
                                <option value="ACTIVE">{t('Activas')}</option>
                                <option value="WATCH">{t('Vigilar')}</option>
                                <option value="CANCELLED">{t('Canceladas')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2">{t('Probabilidad Mínima')}: {minProbability}%</label>
                            <input
                                type="range"
                                min="50"
                                max="95"
                                step="5"
                                value={minProbability}
                                onChange={(e) => setMinProbability(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* Alerts List */}
                {loading && alerts.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        <span className="ml-4 text-gray-400 text-lg">{t('Analizando condiciones de mercado...')}</span>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="text-center py-20">
                        <AlertTriangle className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-xl text-gray-400 mb-2">{t('No hay señales que coincidan con los filtros')}</p>
                        <p className="text-sm text-gray-500">{t('Ajusta los filtros o espera a que se generen nuevas alertas')}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={`bg-gray-800 rounded-2xl p-6 border-2 transition-all ${getStrategyColor(alert.strategy)}`}
                            >
                                {/* Alert Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-3 rounded-xl ${alert.strategy === 'BULL_PUT_SPREAD' ? 'bg-green-600/20 text-green-400' :
                                            alert.strategy === 'BEAR_CALL_SPREAD' ? 'bg-red-600/20 text-red-400' :
                                                'bg-purple-600/20 text-purple-400'
                                            }`}>
                                            {getStrategyIcon(alert.strategy)}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{alert.strategyLabel}</h3>
                                            <div className="flex items-center space-x-3 mt-1">
                                                <span className="text-sm text-gray-400">{alert.underlying}</span>
                                                <span className="text-gray-600">•</span>
                                                <span className="text-sm text-gray-400">Exp: {alert.expiration}</span>
                                                <span className="text-gray-600">•</span>
                                                <span className="text-xs text-gray-500">
                                                    <Clock className="h-3 w-3 inline mr-1" />
                                                    {new Date(alert.generatedAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        {getStatusBadge(alert.status)}
                                        {getQualityBadge(alert.qualityLevel, alert.qualityScore)}
                                        {getRiskBadge(alert.riskLevel)}
                                        {alert.metadata && alert.metadata.moveRatio > 1.0 && (
                                            <span className="text-xs text-orange-400">
                                                📊 Move: {alert.metadata.moveRatio.toFixed(1)}× expected
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Legs Table */}
                                {alert.legs.length > 0 && (
                                    <div className="bg-gray-900/50 rounded-xl p-4 mb-6 border border-gray-700">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-gray-500 text-xs uppercase border-b border-gray-700">
                                                    <th className="text-left pb-3 font-medium">{t('Acción')}</th>
                                                    <th className="text-left pb-3 font-medium">{t('Tipo')}</th>
                                                    <th className="text-right pb-3 font-medium">{t('Strike')}</th>
                                                    <th className="text-right pb-3 font-medium">{t('Precio')}</th>
                                                    <th className="text-right pb-3 font-medium">Delta</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {alert.legs.map((leg, i) => (
                                                    <tr key={i} className="border-b border-gray-800 last:border-0">
                                                        <td className={`py-3 font-bold ${leg.action === 'SELL' ? 'text-red-400' : 'text-green-400'}`}>
                                                            {leg.action}
                                                        </td>
                                                        <td className="py-3 text-gray-300">{leg.type}</td>
                                                        <td className="py-3 text-right text-white font-mono font-bold">${leg.strike.toFixed(0)}</td>
                                                        <td className="py-3 text-right text-gray-300 font-mono">${leg.price.toFixed(2)}</td>
                                                        <td className="py-3 text-right text-gray-400 font-mono">{leg.delta.toFixed(3)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                                        <div className="text-xs text-gray-500 uppercase mb-2">{t('Crédito Neto')}</div>
                                        <div className="text-2xl font-bold text-green-400">${alert.netCredit.toFixed(2)}</div>
                                        <div className="text-xs text-gray-500 mt-1">${(alert.netCredit * 100).toFixed(0)} total</div>
                                    </div>
                                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                                        <div className="text-xs text-gray-500 uppercase mb-2">{t('Max Pérdida')}</div>
                                        <div className="text-2xl font-bold text-red-400">${alert.maxLoss.toFixed(2)}</div>
                                        <div className="text-xs text-gray-500 mt-1">${(alert.maxLoss * 100).toFixed(0)} total</div>
                                    </div>
                                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                                        <div className="text-xs text-gray-500 uppercase mb-2">{t('Prob. Profit')}</div>
                                        <div className="text-2xl font-bold text-blue-400">{alert.probability}%</div>
                                        <div className="text-xs text-gray-500 mt-1">~{(100 - alert.probability).toFixed(0)}% riesgo</div>
                                    </div>
                                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                                        <div className="text-xs text-gray-500 uppercase mb-2">{t('Risk/Reward')}</div>
                                        <div className="text-2xl font-bold text-purple-400">{alert.riskReward}</div>
                                        <div className="text-xs text-gray-500 mt-1">ratio</div>
                                    </div>
                                </div>

                                {/* Rationale */}
                                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4">
                                    <div className="flex items-start space-x-3">
                                        <Zap className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <div className="text-sm font-bold text-blue-300 mb-1">{t('Contexto GEX')}</div>
                                            <p className="text-sm text-blue-200 leading-relaxed">{alert.rationale}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer: GEX Context + Actions */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                                    <div className="flex items-center space-x-6 text-xs">
                                        <div>
                                            <span className="text-gray-500">{t('Régimen')}:</span>
                                            <span className={`ml-2 font-medium ${alert.gexContext.regime === 'stable' ? 'text-green-400' :
                                                alert.gexContext.regime === 'volatile' ? 'text-red-400' :
                                                    'text-yellow-400'
                                                }`}>
                                                {alert.gexContext.regime}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">{t('Net Drift')}:</span>
                                            <span className={`ml-2 font-medium ${alert.gexContext.netDrift > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {alert.gexContext.netDrift > 0 ? '+' : ''}{alert.gexContext.netDrift.toFixed(2)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">{t('Spot')}:</span>
                                            <span className="ml-2 font-medium text-white">${alert.gexContext.currentPrice.toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">{t('Walls')}:</span>
                                            <span className="ml-2 font-medium text-gray-300">
                                                ${alert.gexContext.putWall.toFixed(0)} - ${alert.gexContext.callWall.toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/ladder/${alert.underlying}`}
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        {t('Ver en Ladder')}
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
