import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Shield, AlertTriangle, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketStore } from '../../stores/marketStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { GammaCurveChart } from '../charts/GammaCurveChart';

interface GEXMetrics {
    totalGEX: number;         // Gamma Exposure Total
    gammaFlip: number;        // Precio donde GEX cambia de positivo a negativo
    netInstitutionalDelta: number;  // Delta neto institucional
    netDrift: number;         // Dirección de empuje del mercado
    callWall: number;         // Resistencia (strike con mayor Call GEX)
    putWall: number;          // Soporte (strike con mayor Put GEX)
    currentPrice: number;     // Precio actual del subyacente
    regime: 'stable' | 'volatile' | 'neutral'; // Régimen de volatilidad
    expectedMove?: number;    // Movimiento esperado del día
    netVanna: number;         // Exposición Vanna Neta
    netCharm: number;         // Exposición Charm Neta
    gammaProfile?: Array<{ price: number, netGex: number }>; // Curva Gamma
}

export function GEXMetricsHUD() {
    const { t } = useTranslation();
    const { gexMetrics, selectedSymbol, setSelectedSymbol } = useMarketStore();
    const [loading, setLoading] = useState(true);
    const [showProfile, setShowProfile] = useState(true);

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

    const { sendMessage } = useWebSocket({
        url: wsUrl,
        onMessage: (message) => {
            if (message.type === 'option_trade') {
                const trade = message.data;
                const currentSymbol = selectedSymbol === 'SPX' ? '$SPX' : selectedSymbol;
                if (trade.symbol === currentSymbol || trade.symbol === selectedSymbol) {
                    useMarketStore.setState((state) => ({
                        gexMetrics: state.gexMetrics ? { ...state.gexMetrics, currentPrice: trade.price } : null
                    }));
                }
            }
        }
    });

    useEffect(() => {
        const symbol = selectedSymbol || 'SPX';
        // Cargar métricas iniciales
        fetchGEXMetrics(symbol);

        // Subscribe to real-time price
        const subSymbol = symbol === 'SPX' ? '$SPX' : symbol;
        sendMessage({
            type: 'subscribe',
            symbols: [subSymbol]
        });

        // Actualizar cada 10 segundos
        const interval = setInterval(() => fetchGEXMetrics(symbol), 10000);
        return () => {
            clearInterval(interval);
            sendMessage({
                type: 'unsubscribe',
                symbols: [subSymbol]
            });
        };
    }, [selectedSymbol]);

    const fetchGEXMetrics = async (symbol: string) => {
        try {
            // Solo poner loading en true si no tenemos métricas previas para este símbolo
            setLoading(true);

            const response = await fetch(`/api/gex/metrics?symbol=${symbol}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                console.warn('⚠️ GEX API returned error:', data.error);
                return;
            }

            useMarketStore.setState({ gexMetrics: data });
        } catch (error) {
            console.error('❌ Failed to fetch GEX metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!gexMetrics) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-center">
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            <span className="ml-3 text-gray-400">{t('Loading GEX Metrics...')}</span>
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="h-6 w-6 text-yellow-500" />
                            <span className="ml-3 text-gray-400">{t('No GEX Data Available - Connect Schwab')}</span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const {
        totalGEX,
        gammaFlip,
        netInstitutionalDelta,
        netDrift,
        callWall,
        putWall,
        currentPrice,
        regime,
        expectedMove,
        netVanna,
        netCharm
    } = gexMetrics;

    // Determinar color del Total GEX
    const getTotalGEXColor = () => {
        if (totalGEX > 0) return 'text-green-400';
        if (totalGEX < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    // Determinar color del régimen
    const getRegimeColor = () => {
        switch (regime) {
            case 'stable':
                return 'bg-green-900 text-green-300 border-green-500';
            case 'volatile':
                return 'bg-red-900 text-red-300 border-red-500';
            default:
                return 'bg-yellow-900 text-yellow-300 border-yellow-500';
        }
    };

    const formatNumber = (num: number, decimals: number = 2) => {
        if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
        if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
        if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
        return num.toFixed(decimals);
    };

    return (
        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700 shadow-xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <Activity className="h-6 w-6 mr-2 text-blue-500" />
                        {t('GEX Market Intelligence HUD')}
                    </h2>

                    {/* Symbol Selector */}
                    <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-700">
                        {['SPX', 'SPY', 'QQQ', 'IWM'].map((sym) => (
                            <button
                                key={sym}
                                onClick={() => setSelectedSymbol(sym)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${(selectedSymbol === sym || (!selectedSymbol && sym === 'SPX'))
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                    }`}
                            >
                                {sym}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`px-3 py-1 rounded-lg border ${getRegimeColor()} font-bold text-sm uppercase self-start md:self-auto`}>
                    {regime === 'stable' && '🟢 '}
                    {regime === 'volatile' && '🔴 '}
                    {regime === 'neutral' && '🟡 '}
                    {t(regime)}
                </div>
            </div>

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3">

                {/* Total GEX */}
                <MetricCard
                    icon={<Activity className="h-5 w-5" />}
                    label={t('Total GEX')}
                    value={formatNumber(totalGEX)}
                    valueColor={getTotalGEXColor()}
                    subtitle={totalGEX > 0 ? t('Dealers absorbing') : t('Dealers amplifying')}
                    trend={totalGEX > 0 ? 'stable' : 'volatile'}
                    tooltip={t('Exposición total de Gamma de los Market Makers. Positivo (Green) significa que frenan el mercado. Negativo (Red) significa que aceleran el movimiento.')}
                />

                {/* Gamma Flip */}
                <MetricCard
                    icon={<Target className="h-5 w-5" />}
                    label={t('Gamma Flip')}
                    value={`$${gammaFlip.toFixed(2)}`}
                    valueColor={currentPrice < gammaFlip ? 'text-red-400' : 'text-green-400'}
                    subtitle={currentPrice < gammaFlip ? t('Below - High Vol') : t('Above - Stable')}
                    trend={currentPrice < gammaFlip ? 'volatile' : 'stable'}
                    tooltip={t('El nivel de precio donde el mercado cambia de régimen estable a volátil. Por debajo de este nivel, los Dealers venden cuando el mercado cae, aumentando la volatilidad.')}
                />

                {/* Expected Move */}
                <MetricCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label={t('Expected Move')}
                    value={expectedMove ? `±$${expectedMove.toFixed(1)}` : '--'}
                    valueColor="text-purple-400"
                    subtitle={expectedMove && currentPrice > 0 ? `${((expectedMove / currentPrice) * 100).toFixed(2)}%` : t('Calculating...')}
                    trend="stable"
                    tooltip={t('El rango máximo de movimiento esperado para hoy basado en el precio de los Straddles ATM. El 68% del tiempo el precio terminará dentro de esta frontera.')}
                />

                {/* Net Institutional Delta */}
                <MetricCard
                    icon={netInstitutionalDelta > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    label={t('Net Inst Delta')}
                    value={formatNumber(netInstitutionalDelta)}
                    valueColor={netInstitutionalDelta > 0 ? 'text-green-400' : 'text-red-400'}
                    subtitle={netInstitutionalDelta > 0 ? t('Bullish Positioning') : t('Bearish Positioning')}
                    trend={netInstitutionalDelta > 0 ? 'up' : 'down'}
                    tooltip={t('Mide el sesgo direccional de las instituciones según sus posiciones en opciones. Positivo indica presión de compra; negativo indica presión de venta.')}
                />

                {/* Net Drift */}
                <MetricCard
                    icon={netDrift > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    label={t('Net Drift')}
                    value={netDrift > 0 ? `+${formatNumber(netDrift)}` : formatNumber(netDrift)}
                    valueColor={netDrift > 0 ? 'text-green-400' : 'text-red-400'}
                    subtitle={t('Market Push Direction')}
                    trend={netDrift > 0 ? 'up' : 'down'}
                    tooltip={t('La fuerza de empuje o "deriva" del mercado. Si es alto y positivo, los Dealers están obligados a comprar para cubrirse mientras el precio sube, creando una tendencia.')}
                />

                {/* Net Vanna - NEW */}
                <MetricCard
                    icon={<Activity className="h-5 w-5" />}
                    label={t('Net Vanna')}
                    value={formatNumber(netVanna)}
                    valueColor={netVanna > 0 ? 'text-green-400' : 'text-red-400'}
                    subtitle={netVanna > 0 ? t('IV Drop → Buy') : t('IV Drop → Sell')}
                    trend={netVanna > 0 ? 'up' : 'down'}
                    tooltip={t('Mide cómo reaccionan los Dealers ante cambios en la Volatilidad (IV). Si es positivo (Verde), una caída de IV fuerza a los Dealers a comprar (Viento a favor). Si es negativo (Rojo), una caída de IV los fuerza a vender.')}
                />

                {/* Net Charm - NEW */}
                <MetricCard
                    icon={<Activity className="h-5 w-5" />}
                    label={t('Net Charm')}
                    value={formatNumber(netCharm)}
                    valueColor={netCharm > 0 ? 'text-green-400' : 'text-red-400'}
                    subtitle={netCharm > 0 ? t('Time → Buy') : t('Time → Sell')}
                    trend={netCharm > 0 ? 'up' : 'down'}
                    tooltip={t('Mide el efecto del paso del tiempo (Delta Decay) en las coberturas de los Dealers. Si es positivo (Verde), el simple paso del tiempo obliga a los Dealers a comprar acciones (Rally de cierre). Si es negativo (Rojo), los obliga a vender.')}
                />

                {/* Put Wall */}
                <MetricCard
                    icon={<Shield className="h-5 w-5 rotate-180" />}
                    label={t('Put Wall')}
                    value={`$${putWall.toFixed(0)}`}
                    valueColor="text-green-400"
                    subtitle={t('Support Level')}
                    trend="support"
                    highlight={Math.abs(currentPrice - putWall) / currentPrice < 0.01}
                    tooltip={t('El Strike con mayor exposición de Gamma en Puts. Actúa como el soporte más sólido. Es donde los Dealers compran agresivamente para frenar la caída.')}
                />

                {/* Call Wall */}
                <MetricCard
                    icon={<Shield className="h-5 w-5" />}
                    label={t('Call Wall')}
                    value={`$${callWall.toFixed(0)}`}
                    valueColor="text-red-400"
                    subtitle={t('Resistance Level')}
                    trend="resistance"
                    highlight={Math.abs(currentPrice - callWall) / currentPrice < 0.01}
                    tooltip={t('El Strike con mayor exposición de Gamma en Calls. Actúa como un imán que frena las subidas. Es la resistencia estadística más fuerte del día.')}
                />
            </div>

            {/* Additional Context Bar */}
            <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

                    {/* Price Position */}
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-gray-400">{t('Current Price')}:</span>
                        <span className="text-white font-bold">${currentPrice.toFixed(2)}</span>
                    </div>

                    {/* Distance to Gamma Flip */}
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className={`h-4 w-4 ${Math.abs(currentPrice - gammaFlip) / currentPrice < 0.01 ? 'text-orange-500 animate-pulse' : 'text-gray-500'}`} />
                        <span className="text-gray-400">{t('Distance to Flip')}:</span>
                        <span className={`font-mono ${Math.abs(currentPrice - gammaFlip) / currentPrice < 0.01 ? 'text-orange-400 font-bold' : 'text-gray-300'}`}>
                            {((currentPrice - gammaFlip) / currentPrice * 100).toFixed(2)}%
                        </span>
                    </div>

                    {/* Trading Range */}
                    <div className="flex items-center space-x-2">
                        <Target className="h-4 w-4 text-purple-500" />
                        <span className="text-gray-400">{t('Wall Range')}:</span>
                        <span className="text-white font-mono">
                            ${putWall.toFixed(0)} - ${callWall.toFixed(0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Gamma Curve Analysis - NEW */}
            {gexMetrics.gammaProfile && gexMetrics.gammaProfile.length > 0 && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div
                        className="flex items-center justify-between mb-2 px-2 cursor-pointer group"
                        onClick={() => setShowProfile(!showProfile)}
                    >
                        <div className="flex items-center space-x-2">
                            <Activity className="h-4 w-4 text-blue-400" />
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{t('Gamma Curve Analysis (Theoretical Profile)')}</span>
                        </div>
                        {showProfile ? <ChevronUp className="h-4 w-4 text-gray-500 group-hover:text-white" /> : <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-white" />}
                    </div>

                    {showProfile && (
                        <GammaCurveChart
                            data={gexMetrics.gammaProfile}
                            currentPrice={currentPrice}
                            gammaFlip={gammaFlip}
                        />
                    )}
                </div>
            )}

            {/* Interpretation Guide */}
            <div className="mt-4 p-3 bg-gray-900 bg-opacity-50 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="font-semibold text-blue-400">{t('Trading Insight')}:</span>
                    {' '}
                    {regime === 'stable' && t('Positive GEX indicates dealers will dampen price movements. Expect lower volatility and mean reversion behavior.')}
                    {regime === 'volatile' && t('Negative GEX indicates dealers will amplify price movements. Expect higher volatility and momentum behavior. Trade with caution!')}
                    {regime === 'neutral' && t('Market is near gamma neutral. Volatility regime unclear - watch for directional confirmation.')}
                </p>
            </div>
        </div>
    );
}

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueColor: string;
    subtitle: string;
    trend?: 'up' | 'down' | 'stable' | 'volatile' | 'resistance' | 'support';
    highlight?: boolean;
    tooltip?: string;
}

function MetricCard({ icon, label, value, valueColor, subtitle, trend, highlight, tooltip }: MetricCardProps) {
    const getIconColor = () => {
        if (trend === 'up') return 'text-green-500';
        if (trend === 'down') return 'text-red-500';
        if (trend === 'stable') return 'text-green-500';
        if (trend === 'volatile') return 'text-red-500';
        if (trend === 'resistance') return 'text-red-500';
        if (trend === 'support') return 'text-green-500';
        return 'text-gray-500';
    };

    return (
        <div className={`group relative bg-gray-900 rounded-lg p-3 border transition-all duration-300 ${highlight
            ? 'border-orange-500 shadow-lg shadow-orange-500/20 animate-pulse'
            : 'border-gray-700 hover:border-gray-600'
            }`}>
            {/* Tooltip */}
            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-black/95 text-white text-[11px] rounded-xl border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl backdrop-blur-sm leading-relaxed">
                    <div className="font-bold text-blue-400 mb-1 border-b border-gray-800 pb-1">{label}</div>
                    {tooltip}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black/95"></div>
                </div>
            )}

            <div className="flex items-center justify-between mb-2">
                <div className={getIconColor()}>
                    {icon}
                </div>
            </div>
            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">
                {label}
            </div>
            <div className={`text-lg font-bold ${valueColor} mb-1 font-mono truncate`}>
                {value}
            </div>
            <div className="text-[10px] text-gray-400">
                {subtitle}
            </div>
        </div>
    );
}
