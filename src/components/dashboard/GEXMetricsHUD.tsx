import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Shield, AlertTriangle, Target, ChevronDown, ChevronUp, CheckCircle, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
    netVanna: number;
    netCharm: number;
    callWallStrength?: 'solid' | 'weak' | 'uncertain';
    putWallStrength?: 'solid' | 'weak' | 'uncertain';
    callWallLiquidity?: number;
    putWallLiquidity?: number;
    pinningTarget?: number;
    pinningConfidence?: number;
    pinningRationale?: string;
    maxPain?: number;
    ivRank?: number;
    termStructure?: Array<{ dte: number, iv: number }>;
    gammaProfile?: Array<{ price: number, netGex: number }>;
}

// Mini Componente para el gráfico de Term Structure
const TermStructureChart = ({ data }: { data: Array<{ dte: number, iv: number }> }) => {
    if (!data || data.length < 2) return <div className="h-10 flex items-center justify-center text-[10px] text-gray-500 italic">Insuff. Data</div>;

    const width = 120;
    const height = 40;
    const padding = 5;

    // Limitar a los primeros 10 puntos
    const plotData = data.slice(0, 10);
    const maxDte = Math.max(...plotData.map(d => d.dte));
    const minDte = Math.min(...plotData.map(d => d.dte));
    const maxIv = Math.max(...plotData.map(d => d.iv));
    const minIv = Math.min(...plotData.map(d => d.iv));

    const getX = (dte: number) => padding + (dte - minDte) / (maxDte - minDte || 1) * (width - 2 * padding);
    const getY = (iv: number) => (height - padding) - (iv - minIv) / (maxIv - minIv || 1) * (height - 2 * padding);

    // Detectar Backwardation (IV cercana > IV lejana)
    const isBackwardation = plotData[0].iv > plotData[plotData.length - 1].iv;
    const color = isBackwardation ? '#f87171' : '#60a5fa';

    const points = plotData.map(d => `${getX(d.dte)},${getY(d.iv)}`).join(' ');

    return (
        <div className="flex flex-col items-center mt-2 w-full">
            <svg width={width} height={height} className="overflow-visible">
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#374151" strokeWidth="1" />
                <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                {plotData.map((d, i) => (
                    <circle key={i} cx={getX(d.dte)} cy={getY(d.iv)} r="1.5" fill={color} />
                ))}
            </svg>
            <div className="flex justify-between w-full mt-1 px-1">
                <span className="text-[8px] text-gray-500 font-mono">{plotData[0].dte}d</span>
                <span className="text-[8px] font-bold uppercase tracking-tighter" style={{ color }}>
                    {isBackwardation ? 'Backward' : 'Contango'}
                </span>
                <span className="text-[8px] text-gray-500 font-mono">{plotData[plotData.length - 1].dte}d</span>
            </div>
        </div>
    );
};


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
            <div className="glass-surface rounded-2xl p-6 border border-white/[0.05]">
                <div className="flex items-center justify-center py-8">
                    {loading ? (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full border-2 border-white/10"></div>
                                <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
                            </div>
                            <span className="text-[10px] text-ink-secondary uppercase tracking-widest font-bold">{t('Loading GEX Metrics...')}</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="p-4 bg-warning/10 rounded-full">
                                <AlertTriangle className="h-8 w-8 text-warning" />
                            </div>
                            <span className="text-sm text-ink-secondary font-semibold">{t('No GEX Data Available - Connect Schwab')}</span>
                        </div>
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
        netCharm,
        callWallStrength,
        putWallStrength,
        callWallLiquidity,
        putWallLiquidity,
        pinningTarget,
        pinningConfidence,
        pinningRationale,
        maxPain,
        ivRank,
        termStructure
    } = gexMetrics;

    // Determinar color del Total GEX
    const getTotalGEXColor = () => {
        if (!totalGEX) return 'text-ink-muted';
        if (totalGEX > 0) return 'text-green-400';
        if (totalGEX < 0) return 'text-red-400';
        return 'text-ink-muted';
    };

    // Determinar color del régimen
    const getRegimeColor = () => {
        switch (regime) {
            case 'stable':
                return 'bg-green-500/10 text-green-400 border-green-500/30';
            case 'volatile':
                return 'bg-red-500/10 text-red-400 border-red-500/30';
            default:
                return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
        }
    };

    const formatNumber = (num: number | null | undefined, decimals: number = 2) => {
        if (num === null || num === undefined) return '--';
        if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
        if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
        if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
        return num.toFixed(decimals);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-accent/10 rounded-lg">
                            <Activity className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-tight leading-none">
                                {t('Institutional Market Intelligence HUD')}
                            </h2>
                            <p className="text-[9px] text-ink-tertiary uppercase tracking-wider font-semibold mt-0.5">
                                Real-time Gamma Exposure Analysis
                            </p>
                        </div>
                        <Link
                            to="/academy"
                            className="p-1.5 text-ink-muted hover:text-accent transition-colors rounded-lg hover:bg-accent/10"
                            title={t('Academy Guide')}
                        >
                            <BookOpen className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Symbol Selector */}
                    <div className="flex items-center bg-base/50 border border-white/10 rounded-xl p-1 shadow-inner backdrop-blur-md">
                        <div className="flex gap-1 mr-2 pr-2 border-r border-white/10">
                            {['SPX', 'SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'AMZN', 'AVGO', 'GOOGL', 'MSFT', 'META', 'XLF'].map((sym) => (
                                <button
                                    key={sym}
                                    onClick={() => setSelectedSymbol(sym)}
                                    className={`px-3 py-1.5 text-[9px] font-black rounded-lg transition-all uppercase tracking-widest ${(selectedSymbol === sym || (!selectedSymbol && sym === 'SPX'))
                                        ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_0_12px_rgba(0,242,255,0.1)]'
                                        : 'text-ink-tertiary hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {sym}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex items-center">
                            <input
                                type="text"
                                placeholder="CUSTOM..."
                                className="bg-transparent border-none text-[9px] font-black text-accent w-20 px-2 focus:outline-none placeholder-ink-muted uppercase tracking-wider"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setSelectedSymbol(e.currentTarget.value.toUpperCase());
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                            <Target className="h-3 w-3 text-ink-muted" />
                        </div>
                    </div>

                    {/* Regime Badge */}
                    <div className={`px-4 py-2 rounded-xl border ${getRegimeColor()} font-black text-xs uppercase tracking-widest shadow-sm`}>
                        {regime === 'stable' && '🟢 '}
                        {regime === 'volatile' && '🔴 '}
                        {regime === 'neutral' && '🟡 '}
                        {t(regime)}
                    </div>
                </div>
            </div>


            {/* Main Metrics Grid */}
            <div className="glass-surface rounded-2xl p-6 border border-white/[0.05]">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-10 gap-4">

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
                        value={gammaFlip !== null && gammaFlip !== undefined ? `$${gammaFlip.toFixed(2)}` : '--'}
                        valueColor={currentPrice && gammaFlip && currentPrice < gammaFlip ? 'text-red-400' : 'text-green-400'}
                        subtitle={currentPrice && gammaFlip ? (currentPrice < gammaFlip ? t('Below - High Vol') : t('Above - Stable')) : '--'}
                        trend={currentPrice && gammaFlip ? (currentPrice < gammaFlip ? 'volatile' : 'stable') : 'stable'}
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
                        valueColor={netVanna > 0 ? 'text-emerald-400' : 'text-rose-400'}
                        subtitle={netVanna > 0 ? t('IV Drop → Buy') : t('IV Drop → Sell')}
                        trend={netVanna > 0 ? 'up' : 'down'}
                        tooltip={t('Mide cómo reaccionan los Dealers ante cambios en la Volatilidad (IV). Si es positivo (Verde), una caída de IV fuerza a los Dealers a comprar (Viento a favor). Si es negativo (Rojo), una caída de IV los fuerza a vender.')}
                    />

                    {/* Net Charm - NEW */}
                    <MetricCard
                        icon={<Activity className="h-5 w-5" />}
                        label={t('Net Charm')}
                        value={formatNumber(netCharm)}
                        valueColor={netCharm > 0 ? 'text-emerald-400' : 'text-rose-400'}
                        subtitle={netCharm > 0 ? t('Time → Buy') : t('Time → Sell')}
                        trend={netCharm > 0 ? 'up' : 'down'}
                        tooltip={t('Mide el efecto del paso del tiempo (Delta Decay) en las coberturas de los Dealers. Si es positivo (Verde), el simple paso del tiempo obliga a los Dealers a comprar acciones (Rally de cierre). Si es negativo (Rojo), los obliga a vender.')}
                    />

                    {/* Put Wall */}
                    <MetricCard
                        icon={<Shield className="h-5 w-5 rotate-180" />}
                        label={t('Put Wall')}
                        value={putWall !== null && putWall !== undefined ? `$${putWall.toFixed(0)}` : '--'}
                        valueColor="text-green-400"
                        subtitle={t('Support Level')}
                        trend="support"
                        strength={putWallStrength}
                        liquidity={putWallLiquidity}
                        highlight={currentPrice && putWall ? Math.abs(currentPrice - putWall) / currentPrice < 0.01 : false}
                        tooltip={t('El Strike con mayor exposición de Gamma en Puts. Actúa como el soporte más sólido. Es donde los Dealers compran agresivamente para frenar la caída.')}
                    />

                    {/* Call Wall */}
                    <MetricCard
                        icon={<Shield className="h-5 w-5" />}
                        label={t('Call Wall')}
                        value={callWall !== null && callWall !== undefined ? `$${callWall.toFixed(0)}` : '--'}
                        valueColor="text-red-400"
                        subtitle={t('Resistance Level')}
                        trend="resistance"
                        strength={callWallStrength}
                        liquidity={callWallLiquidity}
                        highlight={currentPrice && callWall ? Math.abs(currentPrice - callWall) / currentPrice < 0.01 : false}
                        tooltip={t('El Strike con mayor exposición de Gamma en Calls. Actúa como un imán que frena las subidas. Es la resistencia estadística más fuerte del día.')}
                    />

                    {/* Pinning Target - NEW */}
                    <MetricCard
                        icon={<Target className="h-5 w-5 text-warning" />}
                        label={t('Pinning Target')}
                        value={pinningTarget ? `$${pinningTarget.toFixed(0)}` : '--'}
                        valueColor="text-yellow-400"
                        subtitle={t('Estimated Closes')}
                        confidence={pinningConfidence}
                        rationale={pinningRationale}
                        highlight={pinningConfidence ? pinningConfidence > 70 : false}
                        tooltip={t('El nivel de precio donde es más probable que el mercado cierre hoy. Se basa en el punto de convergencia de los muros de GEX y la atracción del imán institucional.')}
                    />

                    {/* Max Pain - NEW */}
                    <MetricCard
                        icon={<AlertTriangle className="h-5 w-5 text-pink-400" />}
                        label={t('Max Pain')}
                        value={maxPain ? `$${maxPain.toFixed(0)}` : '--'}
                        valueColor="text-pink-400"
                        subtitle={t('Option Seller Profit Max')}
                        highlight={currentPrice && maxPain ? Math.abs(currentPrice - maxPain) / currentPrice < 0.005 : false}
                        tooltip={t('El precio donde los compradores de opciones (Retail) tienen la mayor pérdida agregada y los vendedores (Market Makers) obtienen el máximo beneficio. Actúa como un imán mecánico al vencimiento.')}
                    />

                    {/* IV Rank - NEW */}
                    <MetricCard
                        icon={<Activity className="h-5 w-5 text-orange-400" />}
                        label={t('IV Rank')}
                        value={ivRank != null ? `${ivRank.toFixed(1)}%` : '--'}
                        valueColor={ivRank != null && ivRank > 70 ? 'text-red-400' : 'text-green-400'}
                        subtitle={ivRank != null && ivRank > 70 ? t('Expensive Options') : t('Cheap Options')}
                        confidence={ivRank}
                        tooltip={t('Mide la Volatilidad Implícita actual frente a su rango histórico de 1 año. >70% significa opciones caras (vencer crédito). <30% significa opciones baratas (comprar protección/momentum).')}
                    />

                    {/* Term Structure - NEW */}
                    <MetricCard
                        icon={<TrendingUp className="h-5 w-5 text-indigo-400" />}
                        label={t('Term Structure')}
                        value={termStructure && termStructure.length > 0 ? `${termStructure[0].iv.toFixed(1)}%` : '--'}
                        valueColor="text-indigo-400"
                        subtitle={termStructure && termStructure.length > 1 && termStructure[0].iv > termStructure[termStructure.length - 1].iv ? 'Backwardation (Panic)' : 'Contango (Normal)'}
                        tooltip={t('Mide la curva de Miedo (IV) en el tiempo. SUBIDA AZUL (Contango): Estado normal/calma. BAJADA ROJA (Backwardation): Pánico o evento inminente. Si hoy es más caro que el futuro, los institucionales pagan lo que sea por protección - Escenario ideal para VENDER prima tras el pico.')}
                    >
                        {termStructure && <TermStructureChart data={termStructure} />}
                    </MetricCard>
                </div>

                {/* Additional Context Bar */}
                <div className="mt-6 pt-6 border-t border-white/[0.05]">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

                        {/* Price Position */}
                        <div className="flex items-center space-x-3 bg-white/[0.02] rounded-lg px-4 py-3 border border-white/[0.05]">
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(0,242,255,0.5)]"></div>
                            <span className="text-ink-tertiary text-xs font-bold uppercase tracking-wider">{t('Current Price')}:</span>
                            <span className="text-white font-black data-font text-lg">${currentPrice ? currentPrice.toFixed(2) : '--'}</span>
                        </div>

                        {/* Distance to Gamma Flip */}
                        <div className="flex items-center space-x-3 bg-white/[0.02] rounded-lg px-4 py-3 border border-white/[0.05]">
                            <AlertTriangle className={`h-4 w-4 ${currentPrice && gammaFlip && Math.abs(currentPrice - gammaFlip) / currentPrice < 0.01 ? 'text-warning animate-pulse' : 'text-ink-muted'}`} />
                            <span className="text-ink-tertiary text-xs font-bold uppercase tracking-wider">{t('Distance to Flip')}:</span>
                            <span className={`data-font font-black ${currentPrice && gammaFlip && Math.abs(currentPrice - gammaFlip) / currentPrice < 0.01 ? 'text-warning' : 'text-ink-secondary'}`}>
                                {currentPrice && gammaFlip ? `${((currentPrice - gammaFlip) / currentPrice * 100).toFixed(2)}%` : '--'}
                            </span>
                        </div>

                        {/* Trading Range */}
                        <div className="flex items-center space-x-3 bg-white/[0.02] rounded-lg px-4 py-3 border border-white/[0.05]">
                            <Target className="h-4 w-4 text-purple-400" />
                            <span className="text-ink-tertiary text-xs font-bold uppercase tracking-wider">{t('Wall Range')}:</span>
                            <span className="text-white data-font font-black">
                                ${putWall ? putWall.toFixed(0) : '--'} - ${callWall ? callWall.toFixed(0) : '--'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gamma Curve Analysis - NEW */}
            {gexMetrics.gammaProfile && gexMetrics.gammaProfile.length > 0 && (
                <div className="glass-surface rounded-2xl p-6 border border-white/[0.05] animate-in fade-in slide-in-from-top-4 duration-500">
                    <div
                        className="flex items-center justify-between mb-4 cursor-pointer group"
                        onClick={() => setShowProfile(!showProfile)}
                    >
                        <div className="flex items-center space-x-3">
                            <div className="p-1.5 bg-accent/10 rounded-lg">
                                <Activity className="h-4 w-4 text-accent" />
                            </div>
                            <span className="text-xs font-black text-white uppercase tracking-widest">{t('Gamma Curve Analysis (Theoretical Profile)')}</span>
                        </div>
                        {showProfile ? <ChevronUp className="h-4 w-4 text-ink-muted group-hover:text-white transition-colors" /> : <ChevronDown className="h-4 w-4 text-ink-muted group-hover:text-white transition-colors" />}
                    </div>

                    {showProfile && (
                        <GammaCurveChart
                            data={gexMetrics.gammaProfile}
                            currentPrice={currentPrice}
                            gammaFlip={gammaFlip}
                            callWall={callWall}
                            putWall={putWall}
                            maxPain={maxPain}
                        />
                    )}
                </div>
            )}

            {/* Interpretation Guide */}
            <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/[0.05]">
                <div className="flex items-start space-x-3">
                    <div className="p-2 bg-accent/10 rounded-lg mt-0.5">
                        <Activity className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-accent uppercase tracking-widest mb-2">{t('Trading Insight')}</h3>
                        <p className="text-xs text-ink-secondary leading-relaxed">
                            {regime === 'stable' && t('Positive GEX indicates dealers will dampen price movements. Expect lower volatility and mean reversion behavior.')}
                            {regime === 'volatile' && t('Negative GEX indicates dealers will amplify price movements. Expect higher volatility and momentum behavior. Trade with caution!')}
                            {regime === 'neutral' && t('Market is near gamma neutral. Volatility regime unclear - watch for directional confirmation.')}
                        </p>
                    </div>
                </div>
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
    strength?: 'solid' | 'weak' | 'uncertain';
    liquidity?: number;
    confidence?: number;
    rationale?: string;
    children?: React.ReactNode;
}

function MetricCard({
    icon, label, value, valueColor, subtitle, trend, highlight, tooltip, strength, liquidity, confidence, rationale, children
}: MetricCardProps) {
    const { t } = useTranslation();
    const getIconColor = () => {
        if (trend === 'up') return 'text-positive';
        if (trend === 'down') return 'text-negative';
        if (trend === 'stable') return 'text-positive';
        if (trend === 'volatile') return 'text-negative';
        if (trend === 'resistance') return 'text-negative';
        if (trend === 'support') return 'text-positive';
        return 'text-ink-muted';
    };

    const getStrengthBadge = () => {
        if (!strength || strength === 'uncertain') return null;

        if (strength === 'solid') {
            return (
                <div className="flex items-center bg-positive/10 border border-positive/30 px-2 py-0.5 rounded-md text-[8px] font-black text-positive uppercase shadow-[0_0_10px_rgba(0,255,163,0.15)]">
                    <CheckCircle className="h-2 w-2 mr-1" />
                    SOLID
                </div>
            );
        }

        return (
            <div className="flex items-center bg-negative/10 border border-negative/30 px-2 py-0.5 rounded-md text-[8px] font-black text-negative uppercase shadow-[0_0_10px_rgba(255,0,85,0.15)]">
                <AlertTriangle className="h-2 w-2 mr-1" />
                WEAK
            </div>
        );
    };

    return (
        <div className={`group relative glass-surface rounded-xl p-4 border transition-all duration-300 ${highlight
            ? 'border-warning/50 shadow-[0_0_20px_rgba(255,204,0,0.2)] animate-pulse'
            : 'border-white/[0.08] hover:border-white/[0.15]'
            }`}>
            {/* Tooltip */}
            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-gray-950 backdrop-blur-xl text-white text-[11px] rounded-xl border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl leading-relaxed">
                    <div className="font-black text-accent mb-2 border-b border-white/10 pb-2 uppercase tracking-wider text-[9px]">{label}</div>
                    <div className="text-ink-secondary">{tooltip}</div>
                    {liquidity !== undefined && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                            <span className="text-ink-tertiary text-[9px] uppercase tracking-wider font-bold">Open Interest:</span>
                            <span className="text-white data-font font-bold">{liquidity.toLocaleString()} contracts</span>
                        </div>
                    )}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-950"></div>
                </div>
            )}

            <div className="flex items-center justify-between mb-3">
                <div className={`p-1.5 rounded-lg bg-white/5 ${getIconColor()}`}>
                    {icon}
                </div>
                {getStrengthBadge()}
            </div>
            <div className="text-[9px] uppercase text-ink-tertiary font-black tracking-[0.15em] mb-2">
                {label}
            </div>
            <div className={`text-2xl font-black ${valueColor} mb-2 data-font tracking-tight truncate`}>
                {value}
            </div>
            <div className="text-[10px] text-gray-300 flex flex-col space-y-2">
                <div className="flex justify-between items-center">
                    <span className="font-semibold">{subtitle}</span>
                    {liquidity !== undefined && liquidity > 0 && (
                        <span className="text-[8px] data-font text-ink-tertiary">OI: {liquidity.toLocaleString()}</span>
                    )}
                </div>
                {confidence !== undefined && (
                    <div className="flex flex-col space-y-1.5">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider">
                            <span className="text-ink-tertiary">{t('Confidenza')}:</span>
                            <span className={confidence > 70 ? 'text-positive' : 'text-warning'}>{confidence.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                            <div
                                className={`h-full transition-all duration-1000 ${confidence > 70
                                    ? 'bg-gradient-to-r from-positive/80 to-positive shadow-[0_0_8px_rgba(0,255,163,0.3)]'
                                    : 'bg-gradient-to-r from-warning/80 to-warning shadow-[0_0_8px_rgba(255,204,0,0.3)]'
                                    }`}
                                style={{ width: `${confidence}%` }}
                            ></div>
                        </div>
                    </div>
                )}
                {rationale && (
                    <div className="text-[9px] text-ink-secondary italic leading-tight border-t border-white/5 pt-2 mt-1 truncate group-hover:whitespace-normal group-hover:bg-gray-950/90 group-hover:backdrop-blur-sm group-hover:z-10 group-hover:absolute group-hover:left-0 group-hover:right-0 group-hover:p-3 group-hover:rounded-b-xl group-hover:border group-hover:border-white/20 transition-all duration-300">
                        {t(rationale)}
                    </div>
                )}
                {strength === 'weak' && (
                    <div className="text-[9px] text-negative font-bold leading-tight mt-2 border-t border-negative/20 pt-2 animate-pulse">
                        ⚠️ {t('Muro Teórico sin Liquidez Real - Posible Ruptura')}
                    </div>
                )}
                {children && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
