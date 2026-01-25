import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface GammaProfileChartProps {
    data: { strike: number; callGex: number; putGex: number; callOi?: number; putOi?: number }[];
    currentPrice?: number;
    symbol?: string;
}

export function GammaProfileChart({ data, currentPrice, symbol }: GammaProfileChartProps) {
    const { t } = useTranslation();

    // Check if we have GEX data or only OI
    const hasGex = useMemo(() => data.some(d => Math.abs(d.callGex) > 0 || Math.abs(d.putGex) > 0), [data]);

    // SVG Dimensions
    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    // Filter significant data to zoom in on the action
    const activeStrikes = useMemo(() => {
        if (data.length === 0) return [];

        // If we have GEX, filter by GEX significant levels
        if (hasGex) {
            return data.filter(d =>
                Math.abs(d.callGex) > 0 ||
                Math.abs(d.putGex) > 0 ||
                (currentPrice && Math.abs(d.strike - currentPrice) < 50)
            );
        }

        // If only OI, filter by OI
        return data.filter(d =>
            (d.callOi || 0) > 0 ||
            (d.putOi || 0) > 0 ||
            (currentPrice && Math.abs(d.strike - currentPrice) < 50)
        );
    }, [data, currentPrice, hasGex]);

    // If filtered data is empty, revert to original (or handle empty state)
    const chartData = activeStrikes.length > 5 ? activeStrikes : data;

    // Scales
    const xMin = Math.min(...chartData.map(d => d.strike));
    const xMax = Math.max(...chartData.map(d => d.strike));

    // Y Max based on GEX or OI
    const yMax = hasGex
        ? Math.max(...chartData.map(d => Math.max(Math.abs(d.callGex), Math.abs(d.putGex))))
        : Math.max(...chartData.map(d => Math.max(Math.abs(d.callOi || 0), Math.abs(d.putOi || 0))));

    // Create a symmetric Y scale for aesthetics
    const limit = yMax > 0 ? yMax * 1.1 : 100; // Add 10% padding

    const getX = (strike: number) => {
        return ((strike - xMin) / (xMax - xMin)) * graphWidth;
    };

    const getY = (value: number) => {
        return graphHeight / 2 - (value / limit) * (graphHeight / 2);
    };

    const zeroY = getY(0);

    // Tick generation
    const xTicks = chartData.filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 10)) === 0).map(d => d.strike);

    // Calculate Totals
    const totalCallGex = useMemo(() => data.reduce((acc, curr) => acc + curr.callGex, 0), [data]);
    const totalPutGex = useMemo(() => data.reduce((acc, curr) => acc + curr.putGex, 0), [data]);
    const totalCallOi = useMemo(() => data.reduce((acc, curr) => acc + (curr.callOi || 0), 0), [data]);
    const totalPutOi = useMemo(() => data.reduce((acc, curr) => acc + (curr.putOi || 0), 0), [data]);

    const netGex = totalCallGex + totalPutGex;

    const formatValue = (val: number, isOi: boolean = false) => {
        if (isOi) return val.toLocaleString();
        const v = Math.abs(val);
        if (v >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
        if (v >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
        if (v >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
        return `$${val.toFixed(0)}`;
    };

    return (
        <div className="w-full bg-gray-900 rounded-lg border border-gray-700 shadow-xl overflow-hidden flex flex-col">
            {/* Header Stats */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/50">
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">
                        {hasGex ? t('Gamma Exposure (GEX)') : t('Open Interest (OI) Profile')}
                        {symbol && <span className="ml-2 text-blue-400 font-mono tracking-tighter">[{symbol}]</span>}
                    </span>
                    {!hasGex && (
                        <span className="bg-yellow-900/30 text-yellow-500 text-[10px] px-2 py-0.5 rounded border border-yellow-800/50">
                            {t('Greeks unavailable - Showing OI')}
                        </span>
                    )}
                </div>
                <div className="flex space-x-6 text-xs">
                    <div className="flex flex-col items-end">
                        <span className="text-gray-400">{hasGex ? 'Total Call GEX' : 'Total Call OI'}</span>
                        <span className="text-green-400 font-mono font-bold">
                            {hasGex ? formatValue(totalCallGex) : formatValue(totalCallOi, true)}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-gray-400">{hasGex ? 'Total Put GEX' : 'Total Put OI'}</span>
                        <span className="text-red-400 font-mono font-bold">
                            {hasGex ? formatValue(totalPutGex) : formatValue(totalPutOi, true)}
                        </span>
                    </div>
                    {hasGex && (
                        <div className="flex flex-col items-end border-l border-gray-700 pl-4">
                            <span className="text-gray-400">Net GEX</span>
                            <span className={`font-mono font-bold ${netGex > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatValue(netGex)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Area */}
            <div className="relative w-full h-[320px] flex items-center justify-center p-2">
                {chartData.length === 0 ? (
                    <div className="text-gray-500 text-sm flex flex-col items-center">
                        <div className="animate-pulse mb-2">Waiting for data...</div>
                    </div>
                ) : (
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d">
                        <defs>
                            <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4ade80" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.5" />
                            </linearGradient>
                            <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#f87171" stopOpacity="0.9" />
                            </linearGradient>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>

                        <g transform={`translate(${margin.left}, ${margin.top})`}>
                            {/* Zero Line */}
                            <line x1={0} y1={zeroY} x2={graphWidth} y2={zeroY} stroke="#4b5563" strokeWidth="1" />

                            {/* Bars */}
                            {chartData.map((d) => {
                                const x = getX(d.strike);
                                const barWidth = (graphWidth / chartData.length) * 0.65;

                                // Values for Call and Put bars
                                const valCall = hasGex ? d.callGex : (d.callOi || 0);
                                const valPut = hasGex ? d.putGex : -(d.putOi || 0); // Put OI shown as negative for balance

                                const yCall = getY(valCall);
                                const hCall = Math.max(0, zeroY - yCall);

                                const yPut = getY(valPut);
                                const hPut = Math.max(0, yPut - zeroY);

                                const isCurrentPrice = currentPrice && Math.abs(d.strike - currentPrice) < 5;

                                return (
                                    <g key={d.strike} opacity={isCurrentPrice ? 1 : 0.85} className="transition-all duration-300 hover:opacity-100">
                                        {/* Call Bar */}
                                        <rect
                                            x={x - barWidth / 2}
                                            y={yCall}
                                            width={barWidth}
                                            height={hCall}
                                            fill="url(#greenGradient)"
                                            className="hover:filter hover:brightness-110"
                                        >
                                            <title>Strike: {d.strike} | {hasGex ? 'Call GEX' : 'Call OI'}: {formatValue(valCall, !hasGex)}</title>
                                        </rect>

                                        {/* Put Bar */}
                                        <rect
                                            x={x - barWidth / 2}
                                            y={zeroY}
                                            width={barWidth}
                                            height={hPut}
                                            fill="url(#redGradient)"
                                            className="hover:filter hover:brightness-110"
                                        >
                                            <title>Strike: {d.strike} | {hasGex ? 'Put GEX' : 'Put OI'}: {formatValue(Math.abs(valPut), !hasGex)}</title>
                                        </rect>
                                    </g>
                                );
                            })}

                            {/* Current Price Marker */}
                            {currentPrice && currentPrice >= xMin && currentPrice <= xMax && (
                                <g>
                                    <line
                                        x1={getX(currentPrice)}
                                        y1={0}
                                        x2={getX(currentPrice)}
                                        y2={graphHeight}
                                        stroke="#60a5fa"
                                        strokeWidth="2"
                                        strokeDasharray="4 2"
                                    />
                                    <rect
                                        x={getX(currentPrice) - 25}
                                        y={-15}
                                        width={50}
                                        height={20}
                                        rx={4}
                                        fill="#3b82f6"
                                    />
                                    <text
                                        x={getX(currentPrice)}
                                        y={-2}
                                        fill="white"
                                        fontSize="10"
                                        textAnchor="middle"
                                        fontWeight="bold"
                                    >
                                        {currentPrice.toFixed(0)}
                                    </text>
                                </g>
                            )}

                            {/* X Axis Labels */}
                            {xTicks.map(strike => (
                                <text
                                    key={strike}
                                    x={getX(strike)}
                                    y={graphHeight + 20}
                                    fill="#9ca3af"
                                    fontSize="10"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                >
                                    {strike}
                                </text>
                            ))}
                        </g>
                    </svg>
                )}
            </div>
        </div>
    );
}
