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

    return (
        <div className="w-full h-[300px] overflow-hidden bg-gray-900 rounded-lg border border-gray-700 shadow-inner flex items-center justify-center">
            {chartData.length === 0 ? (
                <div className="text-gray-500 text-sm">{t('Waiting for profile data')}</div>
            ) : (
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                    {/* Gradients */}
                    <defs>
                        <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.4" />
                        </linearGradient>
                        <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
                        </linearGradient>
                    </defs>

                    <g transform={`translate(${margin.left}, ${margin.top})`}>
                        {/* Axis Lines/Grid */}
                        <line x1={0} y1={zeroY} x2={graphWidth} y2={zeroY} stroke="#374151" strokeWidth="1" strokeDasharray="4 4" />

                        {/* Bars */}
                        {chartData.map((d) => {
                            const x = getX(d.strike);
                            const barWidth = (graphWidth / chartData.length) * 0.8;
                            const yCall = getY(d.callGex);
                            const hCall = zeroY - yCall; // From 0 Up

                            const yPut = getY(d.putGex); // Remember pure putGex is negative
                            const hPut = yPut - zeroY;  // From 0 Down

                            return (
                                <g key={d.strike}>
                                    {/* Call Bar (Up) */}
                                    <rect
                                        x={x - barWidth / 2}
                                        y={yCall}
                                        width={barWidth}
                                        height={hCall}
                                        fill="url(#greenGradient)"
                                        className="hover:opacity-100 opacity-90 transition-opacity"
                                    >
                                        <title>{t('Strike')}: {d.strike} | {t('Call GEX')}: {d.callGex.toLocaleString()}</title>
                                    </rect>

                                    {/* Put Bar (Down) */}
                                    <rect
                                        x={x - barWidth / 2}
                                        y={zeroY}
                                        width={barWidth}
                                        height={Math.abs(hPut)}
                                        fill="url(#redGradient)"
                                        className="hover:opacity-100 opacity-90 transition-opacity"
                                    >
                                        <title>{t('Strike')}: {d.strike} | {t('Put GEX')}: {d.putGex.toLocaleString()}</title>
                                    </rect>
                                </g>
                            );
                        })}

                        {/* Current Price Line */}
                        {currentPrice && currentPrice >= xMin && currentPrice <= xMax && (
                            <line
                                x1={getX(currentPrice)}
                                y1={0}
                                x2={getX(currentPrice)}
                                y2={graphHeight}
                                stroke="#3b82f6"
                                strokeWidth="2"
                                strokeDasharray="6 4"
                            />
                        )}

                        {/* X Axis Labels */}
                        {xTicks.map(strike => (
                            <text
                                key={strike}
                                x={getX(strike)}
                                y={graphHeight + 20}
                                fill="#9ca3af"
                                fontSize="12"
                                textAnchor="middle"
                            >
                                {strike}
                            </text>
                        ))}

                    </g>

                    {/* Title/Legend */}
                    <text x={20} y={20} fill="#fff" fontSize="14" fontWeight="bold">{t('Strikes GEX Put/Call')}</text>
                    <rect x={160} y={10} width={10} height={10} fill="#22c55e" />
                    <text x={180} y={20} fill="#9ca3af" fontSize="12">{t('GEX Call (+)')}</text>
                    <rect x={260} y={10} width={10} height={10} fill="#ef4444" />
                    <text x={280} y={20} fill="#9ca3af" fontSize="12">{t('GEX Put (-)')}</text>
                </svg>
            )}
        </div>
    );
}
