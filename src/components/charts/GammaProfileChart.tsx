import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface GammaProfileChartProps {
    data: { strike: number; callGex: number; putGex: number }[];
    currentPrice?: number;
}

export function GammaProfileChart({ data, currentPrice }: GammaProfileChartProps) {
    const { t } = useTranslation();
    // SVG Dimensions
    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    // Filter significant data to zoom in on the action
    // If we have many strikes, we might want to center around current price or where the GEX is
    const activeStrikes = useMemo(() => {
        // Filter strikes with some minimal GEX or near current price
        // Or just take the whole range if it's 0DTE (usually limited range anyway)
        return data.filter(d => Math.abs(d.callGex) > 1000 || Math.abs(d.putGex) > 1000 || (currentPrice && Math.abs(d.strike - currentPrice) < 50));
    }, [data, currentPrice]);

    // If filtered data is empty, revert to original (or handle empty state)
    const chartData = activeStrikes.length > 5 ? activeStrikes : data;

    // Scales
    const xMin = Math.min(...chartData.map(d => d.strike));
    const xMax = Math.max(...chartData.map(d => d.strike));
    const yMax = Math.max(...chartData.map(d => Math.max(d.callGex, Math.abs(d.putGex))));

    // Create a symmetric Y scale for aesthetics
    const limit = yMax * 1.1; // Add 10% padding

    const getX = (strike: number) => {
        return ((strike - xMin) / (xMax - xMin)) * graphWidth;
    };

    const getY = (value: number) => {
        // Remap value: limit -> 0, -limit -> graphHeight
        // 0 -> graphHeight / 2
        return graphHeight / 2 - (value / limit) * (graphHeight / 2);
    };

    const zeroY = getY(0);

    // Tick generation
    const xTicks = chartData.filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 10)) === 0).map(d => d.strike);

    // Calculate Totals
    const totalCallGex = useMemo(() => data.reduce((acc, curr) => acc + curr.callGex, 0), [data]);
    const totalPutGex = useMemo(() => data.reduce((acc, curr) => acc + curr.putGex, 0), [data]); // putGex usually comes negative or we treat it as negative for chart
    const netGex = totalCallGex + totalPutGex;

    const formatGex = (val: number) => {
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
                    <span className="text-sm font-bold text-white">{t('Gamma Exposure (GEX)')}</span>
                </div>
                <div className="flex space-x-6 text-xs">
                    <div className="flex flex-col items-end">
                        <span className="text-gray-400">Total Call GEX</span>
                        <span className="text-green-400 font-mono font-bold">{formatGex(totalCallGex)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-gray-400">Total Put GEX</span>
                        <span className="text-red-400 font-mono font-bold">{formatGex(totalPutGex)}</span>
                    </div>
                    <div className="flex flex-col items-end border-l border-gray-700 pl-4">
                        <span className="text-gray-400">Net GEX</span>
                        <span className={`font-mono font-bold ${netGex > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatGex(netGex)}
                        </span>
                    </div>
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
                                const yCall = getY(d.callGex);
                                const hCall = Math.max(0, zeroY - yCall);

                                const yPut = getY(d.putGex);
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
                                            <title>Strike: {d.strike} | Call GEX: {formatGex(d.callGex)}</title>
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
                                            <title>Strike: {d.strike} | Put GEX: {formatGex(d.putGex)}</title>
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
