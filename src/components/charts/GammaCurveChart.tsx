import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface GammaCurveChartProps {
    data: Array<{ price: number; netGex: number }>;
    currentPrice: number;
    gammaFlip: number;
    callWall?: number;
    putWall?: number;
}

export function GammaCurveChart({ data, currentPrice, gammaFlip, callWall, putWall }: GammaCurveChartProps) {
    const { t } = useTranslation();

    // SVG Dimensions
    const width = 1000;
    const height = 300;
    const margin = { top: 40, right: 60, bottom: 40, left: 80 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    // Scales
    const { xMin, xMax } = useMemo(() => {
        const prices = data.map(d => d.price);
        if (callWall) prices.push(callWall);
        if (putWall) prices.push(putWall);
        if (currentPrice) prices.push(currentPrice);
        if (gammaFlip) prices.push(gammaFlip);

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        // Añadir un 5% de margen a los lados para que no toque el borde
        const padding = range * 0.05;

        return {
            xMin: min - padding,
            xMax: max + padding
        };
    }, [data, callWall, putWall, currentPrice, gammaFlip]);

    const yMax = useMemo(() => Math.max(...data.map(d => Math.abs(d.netGex))), [data]);

    // Añadir margen superior e inferior al eje Y (25% extra)
    const limit = yMax > 0 ? yMax * 1.25 : 1000000;

    const getX = (price: number) => {
        if (xMax === xMin) return 0;
        return ((price - xMin) / (xMax - xMin)) * graphWidth;
    };
    const getY = (gex: number) => graphHeight / 2 - (gex / limit) * (graphHeight / 2);

    const zeroY = getY(0);

    // Path generation for the area
    const areaPath = useMemo(() => {
        if (data.length < 2) return '';

        let path = `M ${getX(data[0].price)} ${getY(data[0].netGex)}`;
        for (let i = 1; i < data.length; i++) {
            path += ` L ${getX(data[i].price)} ${getY(data[i].netGex)}`;
        }

        // Close the path along the zero line
        const lastX = getX(data[data.length - 1].price);
        const firstX = getX(data[0].price);
        path += ` L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`;

        return path;
    }, [data, zeroY, xMin, xMax]);

    const linePath = useMemo(() => {
        if (data.length < 2) return '';
        let path = `M ${getX(data[0].price)} ${getY(data[0].netGex)}`;
        for (let i = 1; i < data.length; i++) {
            path += ` L ${getX(data[i].price)} ${getY(data[i].netGex)}`;
        }
        return path;
    }, [data, xMin, xMax]);

    const formatValue = (val: number) => {
        const v = Math.abs(val);
        if (v >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
        if (v >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
        return `${(val / 1e3).toFixed(0)}K`;
    };

    return (
        <div className="w-full bg-gray-900/50 rounded-xl border border-gray-800 p-3">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
                    {t('Theoretical Gamma Curve')}
                    <span className="ml-2 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[8px] font-black">
                        {t('ESTRUCTURAL / GLOBAL')}
                    </span>
                </h4>
                <div className="flex space-x-3 text-[9px] uppercase font-bold">
                    <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500/20 border border-green-500 mr-1.5 rounded-sm"></div>
                        <span className="text-green-500/80">{t('Positive Gamma')}</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-2 h-2 bg-red-500/20 border border-red-500 mr-1.5 rounded-sm"></div>
                        <span className="text-red-500/80">{t('Negative Gamma')}</span>
                    </div>
                </div>
            </div>

            <div className="relative h-[280px]">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
                            <stop offset="50%" stopColor="#4ade80" stopOpacity="0.05" />
                            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.05" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
                        </linearGradient>

                        <clipPath id="clip-above">
                            <rect x="0" y="0" width={width} height={zeroY} />
                        </clipPath>
                        <clipPath id="clip-below">
                            <rect x="0" y={zeroY} width={width} height={height - zeroY} />
                        </clipPath>
                    </defs>

                    <g transform={`translate(${margin.left}, ${margin.top})`}>
                        {/* Grid lines */}
                        <line x1={0} y1={zeroY} x2={graphWidth} y2={zeroY} stroke="#374151" strokeWidth="1" />

                        {/* The Curved Area - Above Zero (Green) */}
                        <path d={areaPath} fill="#22c55e" fillOpacity="0.15" clipPath="url(#clip-above)" />

                        {/* The Curved Area - Below Zero (Red) */}
                        <path d={areaPath} fill="#ef4444" fillOpacity="0.15" clipPath="url(#clip-below)" />

                        {/* The Main Line */}
                        <path d={linePath} fill="none" stroke="#9ca3af" strokeWidth="2" strokeOpacity="0.5" />

                        {/* Current Price Marker */}
                        <line
                            x1={getX(currentPrice)} y1={0}
                            x2={getX(currentPrice)} y2={graphHeight}
                            stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2"
                        />
                        <circle cx={getX(currentPrice)} cy={getY(data.find(d => Math.abs(d.price - currentPrice) < 10)?.netGex || 0)} r="4" fill="#3b82f6" />

                        {/* Gamma Flip Marker */}
                        <line
                            x1={getX(gammaFlip)} y1={0}
                            x2={getX(gammaFlip)} y2={graphHeight}
                            stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2"
                        />

                        {/* Put Wall Marker (Support) */}
                        {putWall && (
                            <line
                                x1={getX(putWall)} y1={0}
                                x2={getX(putWall)} y2={graphHeight}
                                stroke="#22c55e" strokeWidth="2" strokeDasharray="5 3"
                            />
                        )}

                        {/* Call Wall Marker (Resistance) */}
                        {callWall && (
                            <line
                                x1={getX(callWall)} y1={0}
                                x2={getX(callWall)} y2={graphHeight}
                                stroke="#ef4444" strokeWidth="2" strokeDasharray="5 3"
                            />
                        )}

                        {/* X-Axis Ticks */}
                        {[xMin, (xMin + xMax) / 2, xMax].map((tick, i) => (
                            <text
                                key={i} x={getX(tick)} y={graphHeight + 18}
                                textAnchor="middle" fill="#9ca3af" fontSize="11" fontFamily="monospace"
                            >
                                ${tick != null ? tick.toFixed(0) : '--'}
                            </text>
                        ))}

                        {/* Y-Axis Ticks */}
                        {[limit, 0, -limit].map((tick, i) => (
                            <text
                                key={i} x={-10} y={getY(tick)}
                                textAnchor="end" dominantBaseline="middle" fill="#9ca3af" fontSize="10" fontFamily="monospace"
                            >
                                {formatValue(tick)}
                            </text>
                        ))}

                        {/* Labels with vertical staggering logic to avoid overlap */}
                        <text x={getX(currentPrice)} y={-25} textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">
                            SPOT: ${currentPrice != null ? currentPrice.toFixed(0) : '--'}
                        </text>

                        <text x={getX(gammaFlip)} y={graphHeight + 35} textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="bold">
                            FLIP: ${gammaFlip != null ? gammaFlip.toFixed(0) : '--'}
                        </text>

                        {putWall && (
                            <text
                                x={getX(putWall)}
                                y={Math.abs(getX(putWall) - getX(currentPrice)) < 30 ? -12 : -10}
                                textAnchor="end"
                                fill="#22c55e"
                                fontSize="9"
                                fontWeight="bold"
                                dx="-5"
                            >
                                PUT WALL: ${putWall != null ? putWall.toFixed(0) : '--'}
                            </text>
                        )}

                        {callWall && (
                            <text
                                x={getX(callWall)}
                                y={Math.abs(getX(callWall) - getX(currentPrice)) < 30 ? -12 : -10}
                                textAnchor="start"
                                fill="#ef4444"
                                fontSize="9"
                                fontWeight="bold"
                                dx="5"
                            >
                                CALL WALL: ${callWall != null ? callWall.toFixed(0) : '--'}
                            </text>
                        )}
                    </g>
                </svg>
            </div>

            <div className="mt-2 flex flex-col gap-1 text-[9px] text-gray-500 font-mono italic">
                <span>* {t('GEX Total: Basado en todos los vencimientos (Macro). Define el régimen de estabilidad general.')}</span>
                <span>* {t('Para el sentimiento de hoy, consulta el Gamma Flip en el ZeroDTE Scanner (Táctico).')}</span>
            </div>
        </div>
    );
}
