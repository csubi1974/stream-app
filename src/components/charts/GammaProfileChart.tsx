import { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface GammaProfileChartProps {
    data: {
        strike: number;
        callGex: number;
        putGex: number;
        callVanna?: number;
        putVanna?: number;
        callOi?: number;
        putOi?: number;
    }[];
    currentPrice?: number;
    symbol?: string;
    mode?: 'GEX' | 'VEX' | 'DEX';
}

export function GammaProfileChart({ data, currentPrice, symbol, mode = 'GEX' }: GammaProfileChartProps) {
    const { t } = useTranslation();

    // Check if we have data for the current mode
    const hasActiveGreeks = useMemo(() => {
        if (mode === 'GEX') {
            return data.some(d => Math.abs(d.callGex) > 0 || Math.abs(d.putGex) > 0);
        } else if (mode === 'VEX') {
            return data.some(d => Math.abs(d.callVanna || 0) > 0 || Math.abs(d.putVanna || 0) > 0);
        } else {
            return data.some(d => Math.abs((d as any).callDex || 0) > 0 || Math.abs((d as any).putDex || 0) > 0);
        }
    }, [data, mode]);

    // SVG Dimensions
    const width = 1200;
    const height = 400;
    const margin = { top: 60, right: 40, bottom: 60, left: 90 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    const [hoveredStrike, setHoveredStrike] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Filter significant data to avoid squashing the chart
    const activeStrikes = useMemo(() => {
        if (data.length === 0) return [];

        // 1. Limitar rango por precio actual (+/- 12% para tener contexto pero sin exagerar)
        let filtered = data;
        if (currentPrice) {
            const rangeLimit = currentPrice * 0.12;
            filtered = data.filter(d => Math.abs(d.strike - currentPrice) <= rangeLimit);
        }

        // If filtering by range leaves too little data, fallback to full data
        if (filtered.length < 5) filtered = data;

        // 2. Filtrar strikes con valores insignificantes (ruido profundo OTM/ITM)
        if (hasActiveGreeks) {
            let maxGreek = 0;
            if (mode === 'GEX') {
                maxGreek = Math.max(...filtered.map(d => Math.max(Math.abs(d.callGex), Math.abs(d.putGex))));
            } else if (mode === 'VEX') {
                maxGreek = Math.max(...filtered.map(d => Math.max(Math.abs(d.callVanna || 0), Math.abs(d.putVanna || 0))));
            } else {
                maxGreek = Math.max(...filtered.map(d => Math.max(Math.abs((d as any).callDex || 0), Math.abs((d as any).putDex || 0))));
            }

            // Umbral del 0.1% del valor máximo para considerar un strike como "activo"
            const threshold = maxGreek * 0.001;

            if (mode === 'GEX') {
                return filtered.filter(d => Math.abs(d.callGex) > threshold || Math.abs(d.putGex) > threshold || (currentPrice && Math.abs(d.strike - currentPrice) < (currentPrice * 0.01)));
            } else if (mode === 'VEX') {
                return filtered.filter(d => Math.abs(d.callVanna || 0) > threshold || Math.abs(d.putVanna || 0) > threshold || (currentPrice && Math.abs(d.strike - currentPrice) < (currentPrice * 0.01)));
            } else {
                return filtered.filter(d => Math.abs((d as any).callDex || 0) > threshold || Math.abs((d as any).putDex || 0) > threshold || (currentPrice && Math.abs(d.strike - currentPrice) < (currentPrice * 0.01)));
            }
        }
        return filtered.filter(d => (d.callOi || 0) > 0 || (d.putOi || 0) > 0 || (currentPrice && Math.abs(d.strike - currentPrice) < (currentPrice * 0.01)));
    }, [data, currentPrice, hasActiveGreeks, mode]);

    const chartData = activeStrikes;

    // Scales
    const strikes = chartData.map(d => d.strike);
    const xMin = strikes.length > 0 ? Math.min(...strikes) : 0;
    const xMax = strikes.length > 0 ? Math.max(...strikes) : 100;

    const yMax = useMemo(() => {
        if (hasActiveGreeks) {
            if (mode === 'GEX') {
                return Math.max(...chartData.map(d => Math.max(Math.abs(d.callGex), Math.abs(d.putGex))));
            } else if (mode === 'VEX') {
                return Math.max(...chartData.map(d => Math.max(Math.abs(d.callVanna || 0), Math.abs(d.putVanna || 0))));
            } else {
                return Math.max(...chartData.map(d => Math.max(Math.abs((d as any).callDex || 0), Math.abs((d as any).putDex || 0))));
            }
        }
        return Math.max(...chartData.map(d => Math.max(Math.abs(d.callOi || 0), Math.abs(d.putOi || 0))));
    }, [chartData, hasActiveGreeks, mode]);

    const limit = yMax > 0 ? yMax * 1.15 : 100;

    const getX = (strike: number) => ((strike - xMin) / (xMax - xMin)) * graphWidth;
    const getY = (value: number) => graphHeight / 2 - (value / limit) * (graphHeight / 2);
    const zeroY = getY(0);

    // Dynamic tick frequency for X axis to prevent overlap
    const xTicks = useMemo(() => {
        if (chartData.length === 0) return [];

        // Siempre incluir el strike más cercano al spot si existe
        let ticks: number[] = [];

        if (chartData.length <= 12) {
            ticks = chartData.map(d => d.strike);
        } else {
            // Seleccionar ~10 ticks distribuidos uniformemente por valor de precio, no por índice
            const minS = Math.min(...chartData.map(d => d.strike));
            const maxS = Math.max(...chartData.map(d => d.strike));
            const step = (maxS - minS) / 8;

            for (let i = 0; i <= 8; i++) {
                const targetStrike = minS + i * step;
                // Encontrar el strike real más cercano al target
                const actual = chartData.reduce((prev, curr) =>
                    Math.abs(curr.strike - targetStrike) < Math.abs(prev.strike - targetStrike) ? curr : prev
                );
                if (!ticks.includes(actual.strike)) ticks.push(actual.strike);
            }
        }

        return ticks.sort((a, b) => a - b);
    }, [chartData]);

    const yTicks = [limit, limit / 2, 0, -limit / 2, -limit];

    const formatValue = (val: number | null | undefined, isOi: boolean = false) => {
        if (val === null || val === undefined) return '--';
        const v = Math.abs(val);
        const prefix = ((mode === 'GEX' || mode === 'DEX') && !isOi) ? '$' : '';
        if (v >= 1e9) return `${prefix}${(val / 1e9).toFixed(2)}B`;
        if (v >= 1e6) return `${prefix}${(val / 1e6).toFixed(2)}M`;
        if (v >= 1e3) return `${prefix}${(val / 1e3).toFixed(1)}K`;
        return `${prefix}${val.toFixed(0)}`;
    };

    // Find "Most Valuable Strike" (Largest Net Exposure)
    const mostValuable = useMemo(() => {
        if (chartData.length === 0) return null;
        return chartData.reduce((prev, curr) => {
            let currentNet, prevNet;
            if (mode === 'GEX') {
                currentNet = Math.abs(curr.callGex) + Math.abs(curr.putGex);
                prevNet = Math.abs(prev.callGex) + Math.abs(prev.putGex);
            } else if (mode === 'VEX') {
                currentNet = Math.abs(curr.callVanna || 0) + Math.abs(curr.putVanna || 0);
                prevNet = Math.abs(prev.callVanna || 0) + Math.abs(prev.putVanna || 0);
            } else {
                currentNet = Math.abs((curr as any).callDex || 0) + Math.abs((curr as any).putDex || 0);
                prevNet = Math.abs((prev as any).callDex || 0) + Math.abs((prev as any).putDex || 0);
            }
            return currentNet > prevNet ? curr : prev;
        });
    }, [chartData, mode]);

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || chartData.length === 0) return;

        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const localPt = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

        const x = localPt.x - margin.left;
        if (x < 0 || x > graphWidth) {
            setHoveredStrike(null);
            return;
        }

        // Find closest strike
        const strikeX = xMin + (x / graphWidth) * (xMax - xMin);
        const closest = chartData.reduce((prev, curr) =>
            Math.abs(curr.strike - strikeX) < Math.abs(prev.strike - strikeX) ? curr : prev
        );
        setHoveredStrike(closest.strike);
    };

    const hoveredData = hoveredStrike !== null ? chartData.find(d => d.strike === hoveredStrike) : null;

    return (
        <div className="w-full bg-black/40 rounded-xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col backdrop-blur-sm">
            {/* Legend & Info Bar */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-800/50 bg-gray-900/20">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] mb-1">
                        {mode === 'GEX' ? 'Gamma Exposure' : 'Vanna Exposure'} Profile
                    </span>
                    <div className="flex items-center space-x-6">
                        {symbol && <span className="text-3xl font-black text-white font-mono tracking-tighter">{symbol}</span>}
                        {mostValuable && (
                            <div className="bg-blue-500/10 px-3 py-1 rounded border border-blue-500/20">
                                <span className="block text-[9px] text-blue-400 uppercase font-bold tracking-wider">Top Strike</span>
                                <span className="text-lg font-bold text-white font-mono">{mostValuable.strike}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-10">
                    {/* Legend */}
                    <div className="flex items-center space-x-6 text-[11px] font-black uppercase tracking-widest bg-gray-900/40 p-3 rounded-lg border border-gray-800/50">
                        <div className="flex items-center group">
                            <div className="w-3.5 h-3.5 bg-red-500/40 border-2 border-red-500 rounded-sm mr-2.5 shadow-[0_0_10px_rgba(239,68,68,0.4)] transition-all group-hover:scale-110"></div>
                            <span className="text-red-400">Puts</span>
                        </div>
                        <div className="flex items-center group">
                            <div className="w-3.5 h-3.5 bg-green-500/40 border-2 border-green-500 rounded-sm mr-2.5 shadow-[0_0_10px_rgba(34,197,94,0.4)] transition-all group-hover:scale-110"></div>
                            <span className="text-green-400">Calls</span>
                        </div>
                        <div className="flex items-center group">
                            <div className="w-6 h-0 border-t-2 border-dashed border-blue-500/80 mr-2.5"></div>
                            <span className="text-blue-400 font-bold">Spot Price</span>
                        </div>
                    </div>

                    {currentPrice && (
                        <div className="text-right border-l border-gray-800 pl-8">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Current Spot</span>
                            <span className="text-2xl text-white font-mono font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                                ${currentPrice != null ? currentPrice.toFixed(2) : '--'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Area */}
            <div className="relative w-full h-[400px] p-6">
                {/* Watermark */}
                {symbol && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
                        <span className="text-[200px] font-black tracking-tighter">{symbol}</span>
                    </div>
                )}

                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full overflow-visible cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredStrike(null)}
                >
                    <defs>
                        <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#15803d" stopOpacity="0.5" />
                        </linearGradient>
                        <linearGradient id="barRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#b91c1c" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.95" />
                        </linearGradient>
                    </defs>

                    <g transform={`translate(${margin.left}, ${margin.top})`}>
                        {/* Grid Lines */}
                        {yTicks.map((tick, i) => (
                            <g key={i}>
                                <line
                                    x1={0} y1={getY(tick)}
                                    x2={graphWidth} y2={getY(tick)}
                                    stroke={tick === 0 ? "#4b5563" : "#111827"}
                                    strokeWidth={tick === 0 ? "1.5" : "1"}
                                    strokeDasharray={tick === 0 ? "0" : "6 6"}
                                />
                                <text
                                    x={-15} y={getY(tick)}
                                    textAnchor="end" dominantBaseline="middle"
                                    fill={tick === 0 ? "#9ca3af" : "#6b7280"}
                                    fontSize="12" fontWeight="bold" fontFamily="monospace"
                                >
                                    {formatValue(tick)}
                                </text>
                            </g>
                        ))}

                        {/* Bars */}
                        {chartData.map((d) => {
                            const x = getX(d.strike);
                            const barWidth = Math.max(10, (graphWidth / chartData.length) * 0.55);

                            let valCall, valPut;
                            if (hasActiveGreeks) {
                                if (mode === 'GEX') {
                                    valCall = d.callGex;
                                    valPut = d.putGex;
                                } else if (mode === 'VEX') {
                                    valCall = d.callVanna || 0;
                                    valPut = d.putVanna || 0;
                                } else {
                                    valCall = (d as any).callDex || 0;
                                    valPut = (d as any).putDex || 0;
                                }
                            } else {
                                valCall = d.callOi || 0;
                                valPut = -(d.putOi || 0);
                            }

                            const yCall = getY(valCall);
                            const hCall = Math.max(0, zeroY - yCall);

                            const yPut = getY(valPut);
                            const hPut = Math.max(0, yPut - zeroY);

                            return (
                                <g key={d.strike} className="transition-all duration-300 hover:brightness-150">
                                    {/* Call Bar */}
                                    <rect
                                        x={x - barWidth / 2} y={yCall}
                                        width={barWidth} height={hCall}
                                        fill="url(#barGreen)" rx={3}
                                    >
                                        <title>Strike: {d.strike} | Call {hasActiveGreeks ? mode : 'OI'}: {formatValue(valCall, !hasActiveGreeks)}</title>
                                    </rect>
                                    {/* Put Bar */}
                                    <rect
                                        x={x - barWidth / 2} y={zeroY}
                                        width={barWidth} height={hPut}
                                        fill="url(#barRed)" rx={3}
                                    >
                                        <title>Strike: {d.strike} | Put {hasActiveGreeks ? mode : 'OI'}: {formatValue(Math.abs(valPut), !hasActiveGreeks)}</title>
                                    </rect>
                                </g>
                            );
                        })}

                        {/* Current Price Marker */}
                        {currentPrice && currentPrice >= xMin && currentPrice <= xMax && (
                            <g>
                                <line
                                    x1={getX(currentPrice)} y1={-20}
                                    x2={getX(currentPrice)} y2={graphHeight + 20}
                                    stroke="#3b82f6" strokeWidth="3" strokeDasharray="8 4"
                                />
                                <circle cx={getX(currentPrice)} cy={-20} r="6" fill="#3b82f6" fillOpacity="0.4" />
                                <circle cx={getX(currentPrice)} cy={-20} r="3" fill="#3b82f6" />
                                <circle cx={getX(currentPrice)} cy={graphHeight + 20} r="6" fill="#3b82f6" fillOpacity="0.4" />
                                <circle cx={getX(currentPrice)} cy={graphHeight + 20} r="3" fill="#3b82f6" />
                            </g>
                        )}

                        {/* X Axis Labels */}
                        {xTicks.map(strike => (
                            <text
                                key={strike} x={getX(strike)} y={graphHeight + 40}
                                fill="#9ca3af" fontSize="10" textAnchor="middle" fontWeight="black" fontFamily="monospace"
                                transform={`rotate(-15, ${getX(strike)}, ${graphHeight + 40})`}
                            >
                                {strike.toLocaleString()}
                            </text>
                        ))}

                        {/* Interactive Crosshair */}
                        {hoveredStrike !== null && (
                            <g>
                                <line
                                    x1={getX(hoveredStrike)} y1={-10}
                                    x2={getX(hoveredStrike)} y2={graphHeight + 10}
                                    stroke="rgba(255, 255, 255, 0.2)"
                                    strokeWidth="1"
                                    pointerEvents="none"
                                />
                                <rect
                                    x={getX(hoveredStrike) - 40} y={-45}
                                    width={80} height={25}
                                    fill="#1e293b" rx={4} stroke="rgba(255,255,255,0.1)"
                                />
                                <text
                                    x={getX(hoveredStrike)} y={-28}
                                    textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="monospace"
                                >
                                    {hoveredStrike}
                                </text>
                            </g>
                        )}
                    </g>
                </svg>

                {/* Floating Tooltip */}
                {hoveredStrike !== null && hoveredData && (
                    <div
                        className="absolute pointer-events-none bg-gray-950/95 border border-gray-700/50 shadow-2xl rounded-lg p-3 z-50 backdrop-blur-md"
                        style={{
                            left: `${(getX(hoveredStrike) + margin.left) / width * 100}%`,
                            top: '50%',
                            transform: `translate(${getX(hoveredStrike) > graphWidth / 2 ? '-110%' : '10%'}, -50%)`,
                            minWidth: '180px'
                        }}
                    >
                        <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 pb-2 border-b border-gray-800">
                            Strike {hoveredStrike}
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-green-400 font-bold uppercase">CALL {hasActiveGreeks ? mode : 'OI'}</span>
                                <span className="text-white font-mono font-bold">
                                    {formatValue(
                                        mode === 'GEX' ? hoveredData.callGex :
                                            mode === 'VEX' ? (hoveredData.callVanna || 0) :
                                                mode === 'DEX' ? ((hoveredData as any).callDex || 0) :
                                                    (hoveredData.callOi || 0),
                                        !hasActiveGreeks
                                    )}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-red-400 font-bold uppercase">PUT {hasActiveGreeks ? mode : 'OI'}</span>
                                <span className="text-white font-mono font-bold">
                                    {formatValue(
                                        mode === 'GEX' ? Math.abs(hoveredData.putGex) :
                                            mode === 'VEX' ? Math.abs(hoveredData.putVanna || 0) :
                                                mode === 'DEX' ? Math.abs((hoveredData as any).putDex || 0) :
                                                    (hoveredData.putOi || 0),
                                        !hasActiveGreeks
                                    )}
                                </span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-gray-800 flex justify-between items-center text-[10px]">
                                <span className="text-gray-400 uppercase">Net Diff</span>
                                <span className={`font-mono font-bold ${(mode === 'GEX' ? (hoveredData.callGex + hoveredData.putGex) :
                                    mode === 'VEX' ? ((hoveredData.callVanna || 0) + (hoveredData.putVanna || 0)) :
                                        mode === 'DEX' ? (((hoveredData as any).callDex || 0) + ((hoveredData as any).putDex || 0)) :
                                            (hoveredData.callOi! - hoveredData.putOi!)) >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    {formatValue(
                                        mode === 'GEX' ? (hoveredData.callGex + hoveredData.putGex) :
                                            mode === 'VEX' ? ((hoveredData.callVanna || 0) + (hoveredData.putVanna || 0)) :
                                                mode === 'DEX' ? (((hoveredData as any).callDex || 0) + ((hoveredData as any).putDex || 0)) :
                                                    (hoveredData.callOi! - hoveredData.putOi!),
                                        !hasActiveGreeks
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Trading Insight Section */}
            <div className="px-8 py-5 bg-blue-500/5 border-t border-gray-800/50">
                <div className="flex items-start space-x-3">
                    <div className="mt-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                    </div>
                    <div className="flex-1">
                        <span className="text-blue-400 font-black text-xs uppercase tracking-widest mr-2 underline decoration-blue-500/30 underline-offset-4">
                            Insight de Trading:
                        </span>
                        <span className="text-gray-300 text-sm leading-relaxed font-medium">
                            {(() => {
                                if (chartData.length === 0) return "Cargando datos de exposición...";

                                const netVal = chartData.reduce((acc, d) => {
                                    if (mode === 'GEX') return acc + (d.callGex + d.putGex);
                                    if (mode === 'VEX') return acc + ((d.callVanna || 0) + (d.putVanna || 0));
                                    return acc + (((d as any).callDex || 0) + ((d as any).putDex || 0));
                                }, 0);

                                const formattedNet = formatValue(netVal, mode === 'VEX');
                                const biasText = netVal >= 0 ? "ALCISTA (Dealer Long)" : "BAJISTA (Dealer Short)";

                                if (mode === 'GEX') {
                                    const totalAbs = chartData.reduce((acc, d) => acc + (Math.abs(d.callGex) + Math.abs(d.putGex)), 0);
                                    const netStrength = totalAbs > 0 ? ((Math.abs(netVal) / totalAbs) * 100).toFixed(1) : "0";

                                    return (
                                        <>
                                            Exposición Gamma neta de <span className="text-white font-bold">{formattedNet}</span> ({netStrength}% dominancia).
                                            El mercado está en <span className={netVal > 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                                                {netVal > 0 ? "Gamma Positiva (Estabilidad)" : "Gamma Negativa (Aceleración)"}
                                            </span>.
                                            {netVal > 0
                                                ? " Los dealers actúan como contraparte amortiguadora: esperan reversión a la media y baja volatilidad."
                                                : " Los dealers deben cubrir agresivamente a favor del movimiento: espera una expansión de la volatilidad y movimientos rápidos."}
                                            {mostValuable && ` Punto crítico de control en strike ${mostValuable.strike}.`}
                                        </>
                                    );
                                }

                                if (mode === 'VEX') {
                                    return (
                                        <>
                                            Exposición Vanna total: <span className="text-white font-bold">{formattedNet}</span>.
                                            Esto indica una alta sensibilidad a la Volatilidad Implícita (IV).
                                            {netVal > 0
                                                ? ` Un descenso en la IV provocará que los dealers COMPREN underlying para re-balancear, impulsando el precio al alza.`
                                                : ` Un descenso en la IV provocará que los dealers VENDAN underlying, lo que podría acelerar caídas incluso en ausencia de malas noticias.`}
                                            {currentPrice != null && mostValuable && ` El spot ($${currentPrice.toFixed(0)}) está cerca del strike de mayor exposición (${mostValuable.strike}).`}
                                        </>
                                    );
                                }

                                if (mode === 'DEX') {
                                    const totalDelta = chartData.reduce((acc, d) => acc + (Math.abs((d as any).callDex || 0) + Math.abs((d as any).putDex || 0)), 0);
                                    const deltaConcentration = totalDelta > 0 ? ((Math.abs(netVal) / totalDelta) * 100).toFixed(1) : "0";

                                    return (
                                        <>
                                            Delta Exposure neta: <span className="text-white font-bold">{formattedNet}</span> (Sesgo: {biasText}).
                                            Concentración del {deltaConcentration}% en la dirección neta.
                                            {Math.abs(netVal) > 1e9
                                                ? " Exposición extrema: Los Market Makers están altamente desbalanceados. Cualquier ruptura de niveles técnicos forzará una cascada de coberturas direccionales."
                                                : " Presión de cobertura moderada. El mercado tiene capacidad para absorber flujos, permitiendo una acción de precio más técnica y menos explosiva."}
                                        </>
                                    );
                                }

                                return "Analizando flujos de opciones para detectar anomalías de mercado...";
                            })()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
