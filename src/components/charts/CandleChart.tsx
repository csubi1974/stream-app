import { createChart, ColorType, ISeriesApi, LineStyle } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

interface ChartProps {
    data?: { time: string | number; open: number; high: number; low: number; close: number }[];
    symbol: string;
    currentPrice?: number;
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
}

export const CandleChart = ({
    data = [],
    symbol,
    currentPrice,
    colors: {
        backgroundColor = '#1f2937', // gray-800
        textColor = '#9ca3af', // gray-400
    } = {},
}: ChartProps) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const [walls, setWalls] = useState<{ callWall: number; putWall: number } | null>(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState('1M');

    // Fetch Walls
    useEffect(() => {
        setWalls(null); // Reset walls on symbol change to avoid stale scaling
        const fetchWalls = async () => {
            try {
                const response = await fetch(`/api/walls/${symbol}`);
                const data = await response.json();
                if (data.callWall && data.putWall) {
                    setWalls(data);
                }
            } catch (error) {
                console.error("Failed to fetch walls", error);
            }
        };
        if (symbol) fetchWalls();
    }, [symbol]);

    // Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            chartRef.current?.applyOptions({
                width: chartContainerRef.current?.clientWidth,
                height: chartContainerRef.current?.clientHeight
            });
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            grid: {
                vertLines: { color: '#374151' }, // gray-700
                horzLines: { color: '#374151' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#374151',
            },
        });

        chartRef.current = chart;

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#22c55e', // green-500
            downColor: '#ef4444', // red-500
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        seriesRef.current = candlestickSeries;

        // Mock Data Logic with Timeframe
        const timeframeToSeconds: Record<string, number> = {
            '1M': 60, '5M': 300, '15M': 900, '30M': 1800, '1H': 3600, '1D': 86400
        };

        // Determine start price from currentPrice or walls
        let startPrice = currentPrice || 0;

        if (walls && walls.callWall && walls.putWall) {
            startPrice = (walls.callWall + walls.putWall) / 2;
        } else if (walls && walls.callWall) {
            startPrice = walls.callWall * 0.95;
        }

        // Only use real data - no mock generation
        if (data.length > 0) {
            // Ensure time is always a number (epoch seconds)
            const formattedData = data.map(candle => ({
                ...candle,
                time: typeof candle.time === 'string' ? parseInt(candle.time) : candle.time
            }));
            candlestickSeries.setData(formattedData as any);
        }

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            seriesRef.current = null;
        };
    }, [data, backgroundColor, textColor, selectedTimeframe, walls, currentPrice]);

    // Fetch History
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Map timeframe to Schwab API params
                // 1M = 1 minute (frequency=1, frequencyType=minute)
                // 5M = 5 minute (frequency=5, frequencyType=minute)
                // 15M = 15 minute
                // 1H = 60 minute? Schwab might need different type for Hourly? frequencyType=minute, frequency=60 works usually
                // 1D = periodType=year/month, frequencyType=daily, frequency=1

                let params = '?periodType=day&period=1&frequencyType=minute&frequency=5';
                if (selectedTimeframe === '1M') params = '?periodType=day&period=1&frequencyType=minute&frequency=1';
                if (selectedTimeframe === '5M') params = '?periodType=day&period=1&frequencyType=minute&frequency=5';
                if (selectedTimeframe === '15M') params = '?periodType=day&period=5&frequencyType=minute&frequency=15';
                if (selectedTimeframe === '30M') params = '?periodType=day&period=5&frequencyType=minute&frequency=30';
                if (selectedTimeframe === '1H') params = '?periodType=day&period=10&frequencyType=minute&frequency=60';
                if (selectedTimeframe === '1D') params = '?periodType=year&period=1&frequencyType=daily&frequency=1';

                const response = await fetch(`/api/history/${symbol}${params}`);
                const historyData = await response.json();

                if (Array.isArray(historyData) && historyData.length > 0) {
                    if (seriesRef.current) {
                        seriesRef.current.setData(historyData);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch history", error);
            }
        };

        if (symbol) {
            fetchHistory();
        }
    }, [symbol, selectedTimeframe]);

    // Draw Walls
    useEffect(() => {
        if (!seriesRef.current || !walls) return;

        const callLine = {
            price: walls.callWall,
            color: '#ef4444', // Red
            lineWidth: 2 as 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'CALL WALL',
        };

        const putLine = {
            price: walls.putWall,
            color: '#22c55e', // Green
            lineWidth: 2 as 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'PUT WALL',
        };

        const cLine = seriesRef.current.createPriceLine(callLine);
        const pLine = seriesRef.current.createPriceLine(putLine);

        // Fit content if walls are loaded
        // if (chartRef.current) {
        //     chartRef.current.timeScale().fitContent();
        // }

        return () => {
            if (seriesRef.current) {
                try {
                    seriesRef.current.removePriceLine(cLine);
                    seriesRef.current.removePriceLine(pLine);
                } catch (e) { /* ignore */ }
            }
        }

    }, [walls]);

    return (
        <div className="w-full relative">
            {/* Chart Container */}
            <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden border border-gray-700" />

            {/* Timeframe Controls Overlay */}
            <div className="absolute top-2 left-2 z-10 flex items-center space-x-2 bg-gray-900/50 p-1 rounded backdrop-blur-sm">
                <span className="text-xs text-gray-400 font-mono font-bold mr-2">{symbol}</span>
                {['1M', '5M', '15M', '30M', '1H', '1D'].map((tf) => (
                    <button
                        key={tf}
                        onClick={() => setSelectedTimeframe(tf)}
                        className={`
                            px-2 py-1 text-[10px] rounded font-medium transition-colors
                            ${selectedTimeframe === tf
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'}
                        `}
                    >
                        {tf}
                    </button>
                ))}
                {walls && (
                    <span className="text-[10px] text-gray-400 ml-2 border-l border-gray-600 pl-2">
                        Walls: <span className="text-red-400">{walls.callWall}</span> / <span className="text-green-400">{walls.putWall}</span>
                    </span>
                )}
            </div>
        </div>
    );
};
