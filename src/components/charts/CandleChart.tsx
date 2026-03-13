import { createChart, ColorType, ISeriesApi, LineStyle, IPriceLine, Time } from 'lightweight-charts';
import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { calculateSMA, calculateRSI, updateLastSMA, updateLastRSI, calculateReversionSignals, calculateTrendPullbackSignals, determineMacroBias, OHLCBar, MacroBias, GEXLevels, BreadthData } from './indicators/indicatorEngine';
import { ActiveIndicator } from './indicators/IndicatorPanel';

interface ChartProps {
    symbol: string;
    timeframe: string;
    onTimeframeChange: (tf: string) => void;
    onDataLoaded?: (lastTime: number) => void;
    initialData?: { time: number; open: number; high: number; low: number; close: number }[];
    activeIndicators?: ActiveIndicator[];
    colors?: {
        backgroundColor?: string;
        textColor?: string;
    };
}

export interface CandleChartHandle {
    updateCandle: (candle: { time: number; open: number; high: number; low: number; close: number }) => void;
    setData: (data: { time: number; open: number; high: number; low: number; close: number }[]) => void;
}

export const CandleChart = forwardRef<CandleChartHandle, ChartProps>(({
    symbol,
    timeframe,
    onTimeframeChange,
    onDataLoaded,
    initialData = [],
    activeIndicators = [],
    colors: {
        backgroundColor = '#0b0e11',
        textColor = '#9ca3af',
    } = {},
}, ref) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const rsiContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const rsiChartRef = useRef<any>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const [walls, setWalls] = useState<{ callWall: number; putWall: number; gammaFlip?: number; topStrike?: number } | null>(null);
    const [reversionDistances, setReversionDistances] = useState<{[key: string]: number}>({});
    const [macroBias, setMacroBias] = useState<MacroBias | null>(null);
    const gexLevelsRef = useRef<GEXLevels | null>(null);
    const breadthRef = useRef<BreadthData | null>(null);
    const historyLoadedRef = useRef(false);
    
    // React refs to track latest symbol and timeframe for closures
    const currentSymbolRef = useRef(symbol);
    const currentTimeframeRef = useRef(timeframe);

    useEffect(() => {
        currentSymbolRef.current = symbol;
        currentTimeframeRef.current = timeframe;
    }, [symbol, timeframe]);

    // Store full OHLC data for indicator calculations
    const fullDataRef = useRef<OHLCBar[]>([]);

    // Map of active SMA overlay series: id -> ISeriesApi
    const smaSeriesMapRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

    const callLineRef = useRef<IPriceLine | null>(null);
    const putLineRef = useRef<IPriceLine | null>(null);
    const flipLineRef = useRef<IPriceLine | null>(null);
    const topStrikeLineRef = useRef<IPriceLine | null>(null);

    // RSI reference lines
    const rsiOverboughtRef = useRef<IPriceLine | null>(null);
    const rsiOversoldRef = useRef<IPriceLine | null>(null);
    const rsiMidRef = useRef<IPriceLine | null>(null);

    const hasRSI = activeIndicators.some(i => i.type === 'RSI');
    const activeSMAs = activeIndicators.filter(i => i.type === 'SMA');
    const activeRSIs = activeIndicators.filter(i => i.type === 'RSI');
    const activeReversions = activeIndicators.filter(i => i.type === 'REVERSION');
    const activeTrend = activeIndicators.filter(i => i.type === 'TREND');

    // ────────────────────────────────────────────
    // Expose methods to parent via ref
    // ────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
        updateCandle: (candle) => {
            if (seriesRef.current && historyLoadedRef.current) {
                try {
                    seriesRef.current.update(candle as any);

                    // Update fullData for indicator calc
                    const data = fullDataRef.current;
                    if (data.length > 0 && data[data.length - 1].time === candle.time) {
                        data[data.length - 1] = candle;
                    } else {
                        data.push(candle);
                    }

                    // Update SMA overlays in real-time
                    smaSeriesMapRef.current.forEach((series, id) => {
                        const ind = activeIndicators.find(i => i.id === id);
                        if (ind) {
                            const point = updateLastSMA(data, ind.period);
                            if (point) {
                                try { series.update(point as any); } catch (e) {}
                            }
                        }
                    });

                    // Update RSI in real-time
                    if (rsiSeriesRef.current && activeRSIs.length > 0) {
                        const rsiPoint = updateLastRSI(data, activeRSIs[0].period);
                        if (rsiPoint) {
                            try { rsiSeriesRef.current.update(rsiPoint as any); } catch (e) {}
                        }
                    }

                    // Update Reversion Markers and Distances in real-time
                    if (activeReversions.length > 0) {
                        updateMarkers(data);
                        
                        // Calculate real-time distances for display
                        const newDistances: {[key: string]: number} = {};
                        activeReversions.forEach(ind => {
                            const entries = data.slice(-ind.period);
                            if (entries.length === ind.period) {
                                const sma = entries.reduce((s, b) => s + b.close, 0) / ind.period;
                                const dist = ((candle.close - sma) / sma) * 100;
                                newDistances[ind.id] = parseFloat(dist.toFixed(2));
                            }
                        });
                        setReversionDistances(newDistances);
                    }
                } catch (e: any) {
                    if (!e.message?.includes('Cannot update oldest data')) {
                        console.error("❌ Chart update error:", e.message);
                    }
                }
            }
        },
        setData: (data) => {
            if (seriesRef.current && Array.isArray(data) && data.length > 0) {
                try {
                    seriesRef.current.setData(data as any);
                    historyLoadedRef.current = true;
                    fullDataRef.current = [...data];

                    // Recalculate all active indicators
                    recalculateIndicators(data);
                } catch (e) {
                    console.error("❌ Failed to set series data:", e);
                }
            }
        }
    }));

    // ────────────────────────────────────────────
    // Recalculate all indicator series
    // ────────────────────────────────────────────
    const recalculateIndicators = useCallback((data: OHLCBar[]) => {
        // Update SMA series
        smaSeriesMapRef.current.forEach((series, id) => {
            const ind = activeIndicators.find(i => i.id === id);
            if (ind) {
                const smaData = calculateSMA(data, ind.period);
                if (smaData.length > 0) {
                    try { series.setData(smaData as any); } catch (e) {}
                }
            }
        });

        // Update RSI series
        if (rsiSeriesRef.current && activeRSIs.length > 0) {
            const rsiData = calculateRSI(data, activeRSIs[0].period);
            if (rsiData.length > 0) {
                try { rsiSeriesRef.current.setData(rsiData as any); } catch (e) {}
            }
        }
        
        // Initial distance calculation
        const initialDistances: {[key: string]: number} = {};
        activeReversions.forEach(ind => {
            const entries = data.slice(-ind.period);
            if (entries.length === ind.period) {
                const sma = entries.reduce((s, b) => s + b.close, 0) / ind.period;
                const lastClose = data[data.length - 1].close;
                const dist = ((lastClose - sma) / sma) * 100;
                initialDistances[ind.id] = parseFloat(dist.toFixed(2));
            }
        });
        setReversionDistances(initialDistances);
        
        updateMarkers(data);
    }, [activeIndicators, walls?.gammaFlip, walls?.topStrike]);

    // ────────────────────────────────────────────
    // Update Markers for Reversion Signals
    // ────────────────────────────────────────────
    const updateMarkers = useCallback((data: OHLCBar[]) => {
        if (!seriesRef.current) return;
        
        let allMarkers: any[] = [];
        const hasSignals = activeReversions.length > 0 || activeTrend.length > 0;

        // Reversion signals (contra-tendencia)
        if (activeReversions.length > 0) {
            activeReversions.forEach(ind => {
                const { signals } = calculateReversionSignals(data, ind.period, 2.0, walls?.topStrike || walls?.gammaFlip);
                signals.forEach(sig => {
                    allMarkers.push({
                        time: sig.time,
                        position: sig.type === 'buy' ? 'belowBar' : 'aboveBar',
                        color: sig.type === 'buy' ? '#10b981' : '#ef4444',
                        shape: sig.type === 'buy' ? 'arrowUp' : 'arrowDown',
                        text: sig.distance > 0 ? `+${sig.distance}%` : `${sig.distance}%`,
                        size: 1,
                    });
                });
            });
        }

        // Trend Pullback signals (pro-tendencia)
        if (activeTrend.length > 0 && macroBias && macroBias.direction !== 'NEUTRAL') {
            const { signals: trendSigs } = calculateTrendPullbackSignals(data, macroBias, gexLevelsRef.current);
            trendSigs.forEach(sig => {
                allMarkers.push({
                    time: sig.time,
                    position: sig.type === 'trend_long' ? 'belowBar' : 'aboveBar',
                    color: sig.type === 'trend_long' ? '#06b6d4' : '#f97316',
                    shape: sig.type === 'trend_long' ? 'arrowUp' : 'arrowDown',
                    text: `${sig.levelType} ${sig.confidence}%`,
                    size: 2,
                });
            });
        }

        if (hasSignals && allMarkers.length > 0) {
            allMarkers.sort((a,b) => a.time - b.time);
            const uniqueMarkers = Array.from(new Map(allMarkers.map(m => [m.time, m])).values());
            try { seriesRef.current.setMarkers(uniqueMarkers as any); } catch (e) {}
        } else {
            try { seriesRef.current.setMarkers([]); } catch (e) {}
        }
    }, [activeReversions, activeTrend, walls?.gammaFlip, walls?.topStrike, macroBias]);

    // ────────────────────────────────────────────
    // Fetch Walls
    // ────────────────────────────────────────────
    useEffect(() => {
        const fetchWalls = async () => {
            try {
                const response = await fetch(`/api/scanner/0dte?symbol=${symbol}`);
                const fullResponse = await response.json();
                
                // Extraer el objeto stats que contiene strikes, muros y flip del scanner 0DTE
                const data = fullResponse.stats;

                if (data && !fullResponse.error) {
                    let calcTopStrike;
                    const spot = data.currentPrice || (fullDataRef.current.length > 0 ? fullDataRef.current[fullDataRef.current.length - 1].close : null);

                    if (data.strikes && data.strikes.length > 0) {
                        // OBTENER el mismo rango de visión que tiene el GammaProfileChart (+/- 3.5%)
                        let activeStrikes = data.strikes;
                        if (spot) {
                            const rangeLimit = spot * 0.035;
                            activeStrikes = data.strikes.filter((d: any) => Math.abs(parseFloat(d.strike) - spot) <= rangeLimit);
                        }
                        if (activeStrikes.length < 5) activeStrikes = data.strikes;

                        // Encontrar el Most Valuable Strike con la misma matemática (Absoluta Call + Absoluta Put)
                        const peak = activeStrikes.reduce((max: any, current: any) => {
                            const currentTarget = Math.abs(current.callGex || 0) + Math.abs(current.putGex || 0);
                            const maxTarget = Math.abs(max.callGex || 0) + Math.abs(max.putGex || 0);
                            return currentTarget > maxTarget ? current : max;
                        }, activeStrikes[0]);
                        
                        if (peak) calcTopStrike = parseFloat(peak.strike);
                    }

                    let cw = parseFloat(data.callWall);
                    let pw = parseFloat(data.putWall);
                    let gf = parseFloat(data.gammaFlip);

                    try {
                        const gexResponse = await fetch(`/api/gex/metrics?symbol=${symbol}`);
                        if (gexResponse.ok) {
                            const gexData = await gexResponse.json();
                            if (gexData && !gexData.error) {
                                cw = parseFloat(gexData.callWall) || cw;
                                pw = parseFloat(gexData.putWall) || pw;
                                gf = parseFloat(gexData.gammaFlip) || gf;
                            }
                        }
                    } catch (e) {
                         console.warn("Failed to fetch GEX metrics for chart, using 0DTE fallbacks");
                    }

                    setWalls({ callWall: cw, putWall: pw, gammaFlip: gf, topStrike: calcTopStrike });

                    // Calculate Net DEX from available strike data
                    let netDex = 0;
                    if (data.strikes) {
                        data.strikes.forEach((s: any) => {
                            netDex += (s.callDex || 0) + (s.putDex || 0);
                        });
                    }

                    // Store GEX levels for trend signals
                    gexLevelsRef.current = {
                        callWall: cw,
                        putWall: pw,
                        gammaFlip: gf,
                        topStrike: calcTopStrike,
                        currentPrice: spot || 0,
                        netDex: netDex,
                        vannaExposure: data.vannaExposure || 0
                    };

                    // Fetch breadth data from volume scanner
                    try {
                        const breadthRes = await fetch('/api/scanner/volume?min_rvol=0&min_dollar_vol=0');
                        const breadthData = await breadthRes.json();
                        if (Array.isArray(breadthData) && breadthData.length > 0) {
                            const gainers = breadthData.filter((s: any) => s.changePercent > 0).length;
                            const losers = breadthData.length - gainers;
                            const totalVol = breadthData.reduce((acc: number, s: any) => acc + (s.dollarVolume || 0), 0);
                            const greenVol = breadthData.filter((s: any) => s.changePercent > 0).reduce((acc: number, s: any) => acc + (s.dollarVolume || 0), 0);
                            const buyPressure = totalVol > 0 ? (greenVol / totalVol) * 100 : 50;

                            breadthRef.current = { gainers, losers, buyPressure };
                        }
                    } catch (e) {
                        // Breadth fetch is non-critical
                    }

                    // Compute Macro Bias
                    const bias = determineMacroBias(gexLevelsRef.current, breadthRef.current);
                    setMacroBias(bias);

                } else {
                    const wallRes = await fetch(`/api/walls/${symbol}`);
                    const wallData = await wallRes.json();
                    if (wallData.callWall) setWalls(wallData);
                }
            } catch (error) {
                console.error("Failed to fetch walls", error);
            }
        };
        if (symbol) fetchWalls();
        const interval = setInterval(fetchWalls, 60000);
        return () => clearInterval(interval);
    }, [symbol]);

    // ────────────────────────────────────────────
    // Initialize Main Chart (runs once)
    // ────────────────────────────────────────────
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            chartRef.current?.applyOptions({
                width: chartContainerRef.current?.clientWidth,
                height: chartContainerRef.current?.clientHeight
            });
            if (rsiChartRef.current && rsiContainerRef.current) {
                rsiChartRef.current.applyOptions({
                    width: rsiContainerRef.current.clientWidth,
                });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            localization: {
                locale: 'en-US',
                timeFormatter: (time: import('lightweight-charts').Time) => {
                    const t = typeof time === 'number' ? time : typeof time === 'string' ? new Date(time).getTime() / 1000 : (time as any).timestamp || 0;
                    return new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone: 'America/New_York'
                    }).format(new Date((t as number) * 1000));
                },
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 600,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                tickMarkFormatter: (time: import('lightweight-charts').Time, tickMarkType: import('lightweight-charts').TickMarkType, locale: string) => {
                    const t = typeof time === 'number' ? time : typeof time === 'string' ? new Date(time).getTime() / 1000 : (time as any).timestamp || 0;
                    const date = new Date((t as number) * 1000);
                    const formatterOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };
                    
                    if (tickMarkType === 0) { // Year
                        formatterOptions.year = 'numeric';
                    } else if (tickMarkType === 1) { // Month
                        formatterOptions.month = 'short';
                    } else if (tickMarkType === 2) { // Day
                        formatterOptions.day = 'numeric';
                        formatterOptions.month = 'short';
                    } else { // Time (3 or 4)
                        formatterOptions.hour = '2-digit';
                        formatterOptions.minute = '2-digit';
                        formatterOptions.hour12 = false;
                    }
                    return new Intl.DateTimeFormat('en-US', formatterOptions).format(date);
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                autoScale: true,
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1,
                    labelBackgroundColor: '#1e222d',
                },
                horzLine: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1,
                    labelBackgroundColor: '#1e222d',
                },
            },
        });

        chartRef.current = chart;

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: true,
            borderColor: '#374151',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        seriesRef.current = candlestickSeries;

        if (initialData.length > 0) {
            candlestickSeries.setData(initialData as any);
            historyLoadedRef.current = true;
            fullDataRef.current = [...initialData];
        }

        let timeoutId: any = null;
        const debouncedHandleZoomPan = (logicalRange: any) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (!chartRef.current || fullDataRef.current.length === 0 || !logicalRange) return;
                
                const maxIndex = fullDataRef.current.length - 1;
                const rightOffset = logicalRange.to - maxIndex;
                const visibleBars = logicalRange.to - logicalRange.from;
                
                const startIdx = Math.max(0, Math.floor(logicalRange.from));
                const endIdx = Math.min(maxIndex, Math.ceil(logicalRange.to));
                
                const state = {
                    rightOffset,
                    visibleBars,
                    isTracking: rightOffset > -2, 
                    timeFrom: fullDataRef.current[startIdx]?.time,
                    timeTo: fullDataRef.current[endIdx]?.time
                };
                
                const key = `chartZoomState_${currentSymbolRef.current}_${currentTimeframeRef.current}`;
                localStorage.setItem(key, JSON.stringify(state));
            }, 500);
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(debouncedHandleZoomPan);

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            smaSeriesMapRef.current.clear();
            chart.remove();
            seriesRef.current = null;
            historyLoadedRef.current = false;
        };
    }, []);

    // ────────────────────────────────────────────
    // Initialize / Destroy RSI Chart
    // ────────────────────────────────────────────
    useEffect(() => {
        if (hasRSI && rsiContainerRef.current && !rsiChartRef.current) {
            const rsiChart = createChart(rsiContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: '#0b0e11' },
                    textColor: '#6b7280',
                    fontFamily: 'Inter, system-ui, sans-serif',
                },
                localization: {
                    locale: 'en-US',
                    timeFormatter: (time: import('lightweight-charts').Time) => {
                        const t = typeof time === 'number' ? time : typeof time === 'string' ? new Date(time).getTime() / 1000 : (time as any).timestamp || 0;
                        return new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                            timeZone: 'America/New_York'
                        }).format(new Date((t as number) * 1000));
                    },
                },
                grid: {
                    vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
                },
                width: rsiContainerRef.current.clientWidth,
                height: 150,
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    borderColor: 'rgba(255, 255, 255, 0.05)',
                    tickMarkFormatter: (time: import('lightweight-charts').Time, tickMarkType: import('lightweight-charts').TickMarkType, locale: string) => {
                        const t = typeof time === 'number' ? time : typeof time === 'string' ? new Date(time).getTime() / 1000 : (time as any).timestamp || 0;
                        const date = new Date((t as number) * 1000);
                        const formatterOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };
                        
                        if (tickMarkType === 0) { // Year
                            formatterOptions.year = 'numeric';
                        } else if (tickMarkType === 1) { // Month
                            formatterOptions.month = 'short';
                        } else if (tickMarkType === 2) { // Day
                            formatterOptions.day = 'numeric';
                            formatterOptions.month = 'short';
                        } else { // Time
                            formatterOptions.hour = '2-digit';
                            formatterOptions.minute = '2-digit';
                            formatterOptions.hour12 = false;
                        }
                        return new Intl.DateTimeFormat('en-US', formatterOptions).format(date);
                    },
                },
                rightPriceScale: {
                    borderColor: 'rgba(255, 255, 255, 0.05)',
                    autoScale: false,
                    scaleMargins: {
                        top: 0.05,
                        bottom: 0.05,
                    },
                },
                crosshair: {
                    mode: 0,
                    vertLine: {
                        color: 'rgba(255, 255, 255, 0.15)',
                        width: 1,
                        labelBackgroundColor: '#1e222d',
                    },
                    horzLine: {
                        color: 'rgba(255, 255, 255, 0.15)',
                        width: 1,
                        labelBackgroundColor: '#1e222d',
                    },
                },
            });

            rsiChartRef.current = rsiChart;

            const rsiColor = activeRSIs[0]?.color || '#a855f7';
            const rsiSeries = rsiChart.addLineSeries({
                color: rsiColor,
                lineWidth: 2,
                priceScaleId: 'right',
                priceFormat: {
                    type: 'price',
                    precision: 1,
                    minMove: 0.1,
                },
            });

            rsiSeriesRef.current = rsiSeries;

            // Add overbought/oversold reference lines
            rsiOverboughtRef.current = rsiSeries.createPriceLine({
                price: 70,
                color: 'rgba(239, 68, 68, 0.4)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: '',
            });

            rsiOversoldRef.current = rsiSeries.createPriceLine({
                price: 30,
                color: 'rgba(16, 185, 129, 0.4)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: '',
            });

            rsiMidRef.current = rsiSeries.createPriceLine({
                price: 50,
                color: 'rgba(255, 255, 255, 0.1)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: '',
            });

            // Sync time scales
            if (chartRef.current) {
                chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
                    if (range && rsiChartRef.current) {
                        rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
                    }
                });
                rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
                    if (range && chartRef.current) {
                        chartRef.current.timeScale().setVisibleLogicalRange(range);
                    }
                });
            }

            // Calculate & set RSI data
            if (fullDataRef.current.length > 0 && activeRSIs.length > 0) {
                const rsiData = calculateRSI(fullDataRef.current, activeRSIs[0].period);
                if (rsiData.length > 0) {
                    rsiSeries.setData(rsiData as any);
                }
            }
        }

        if (!hasRSI && rsiChartRef.current) {
            rsiChartRef.current.remove();
            rsiChartRef.current = null;
            rsiSeriesRef.current = null;
        }

        return () => {
            // Cleanup handled in the !hasRSI block above or chart removal
        };
    }, [hasRSI, activeRSIs.map(r => `${r.id}_${r.period}`).join(',')]);

    // ────────────────────────────────────────────
    // Manage SMA overlay series
    // ────────────────────────────────────────────
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;

        const currentIds = new Set(activeSMAs.map(s => s.id));
        const existingIds = new Set(smaSeriesMapRef.current.keys());

        // Remove series that are no longer active
        existingIds.forEach(id => {
            if (!currentIds.has(id)) {
                const series = smaSeriesMapRef.current.get(id);
                if (series) {
                    try { chartRef.current.removeSeries(series); } catch (e) {}
                    smaSeriesMapRef.current.delete(id);
                }
            }
        });

        // Add new series
        activeSMAs.forEach(ind => {
            if (!smaSeriesMapRef.current.has(ind.id)) {
                const series = chartRef.current.addLineSeries({
                    color: ind.color,
                    lineWidth: 2,
                    crosshairMarkerVisible: false,
                    priceLineVisible: false,
                    lastValueVisible: true,
                });
                smaSeriesMapRef.current.set(ind.id, series);

                // Calculate and set data
                if (fullDataRef.current.length > 0) {
                    const smaData = calculateSMA(fullDataRef.current, ind.period);
                    if (smaData.length > 0) {
                        series.setData(smaData as any);
                    }
                }
            }
        });
    }, [activeSMAs.map(s => `${s.id}_${s.period}_${s.color}`).join(',')]);

    // ────────────────────────────────────────────
    // Fetch history when symbol or timeframe changes
    // ────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        const fetchHistory = async () => {
            historyLoadedRef.current = false;

            let params = `?frequencyType=minute&frequency=5`;
            switch (timeframe) {
                case '1M':  params = `?frequencyType=minute&frequency=1`; break;
                case '5M':  params = `?frequencyType=minute&frequency=5`; break;
                case '15M': params = `?frequencyType=minute&frequency=15`; break;
                case '30M': params = `?frequencyType=minute&frequency=30`; break;
                case '1H':  params = `?frequencyType=minute&frequency=60`; break;
                case '1D':  params = `?frequencyType=daily&frequency=1`; break;
            }

            console.log(`📡 CandleChart: Fetching history for ${symbol} (${timeframe})...`);

            try {
                const cacheBuster = `&_t=${Date.now()}`;
                const response = await fetch(`/api/history/${encodeURIComponent(symbol)}${params}${cacheBuster}`, {
                    cache: 'no-store'
                });
                if (!response.ok) {
                    console.error(`❌ CandleChart: History fetch failed (${response.status})`);
                    return;
                }
                let historyData = await response.json();

                // Fallback for $SPX if empty
                if ((!Array.isArray(historyData) || historyData.length === 0) && symbol === '$SPX') {
                    console.warn("⚠️ $SPX history empty, trying SPX fallback...");
                    const fb = await fetch(`/api/history/SPX${params}`);
                    if (fb.ok) {
                        const fbData = await fb.json();
                        if (Array.isArray(fbData) && fbData.length > 0) {
                            historyData = fbData;
                        }
                    }
                }

                if (cancelled) return;

                if (Array.isArray(historyData) && historyData.length > 0 && seriesRef.current) {
                    historyData.sort((a: any, b: any) => a.time - b.time);

                    // Deduplicate by time to fix "data must be asc ordered" Lightweight Charts error
                    const uniqueData = Array.from(new Map(historyData.map((item: any) => [item.time, item])).values());

                    console.log(`✅ CandleChart: Loaded ${uniqueData.length} candles. Range: ${new Date(uniqueData[0].time * 1000).toISOString()} -> ${new Date(uniqueData[uniqueData.length - 1].time * 1000).toISOString()}`);

                    seriesRef.current.setData(uniqueData as any);
                    historyLoadedRef.current = true;
                    fullDataRef.current = [...uniqueData];
                    
                    const savedStateStr = localStorage.getItem(`chartZoomState_${symbol}_${timeframe}`);
                    if (savedStateStr) {
                        try {
                            const state = JSON.parse(savedStateStr);
                            setTimeout(() => {
                                if (chartRef.current) {
                                    if (state.isTracking) {
                                        const maxIndex = uniqueData.length - 1;
                                        const logicalTo = maxIndex + state.rightOffset;
                                        const logicalFrom = logicalTo - state.visibleBars;
                                        chartRef.current.timeScale().setVisibleLogicalRange({ from: logicalFrom, to: logicalTo });
                                    } else {
                                        let newFromIndex = uniqueData.findIndex((d: any) => d.time >= state.timeFrom);
                                        let newToIndex = uniqueData.findIndex((d: any) => d.time >= state.timeTo);
                                        if (newFromIndex === -1) newFromIndex = 0;
                                        if (newToIndex === -1) newToIndex = uniqueData.length - 1;
                                        chartRef.current.timeScale().setVisibleLogicalRange({ from: newFromIndex, to: newToIndex });
                                    }
                                }
                            }, 50);
                        } catch(e) {
                            chartRef.current?.timeScale().fitContent();
                        }
                    } else {
                        chartRef.current?.timeScale().fitContent();
                    }

                    // Recalculate indicators with new data
                    recalculateIndicators(uniqueData);

                    if (onDataLoaded) {
                        onDataLoaded(uniqueData[uniqueData.length - 1].time);
                    }
                } else {
                    console.warn(`⚠️ CandleChart: No history data for ${symbol}`);
                }
            } catch (error) {
                console.error("❌ Failed to fetch history:", error);
            }
        };

        if (symbol) {
            fetchHistory();
        }

        return () => { cancelled = true; };
    }, [symbol, timeframe]);

    // ────────────────────────────────────────────
    // Draw/Update Walls
    // ────────────────────────────────────────────
    useEffect(() => {
        if (!seriesRef.current || !walls) return;

        try { if (callLineRef.current) seriesRef.current.removePriceLine(callLineRef.current); } catch (e) {}
        try { if (putLineRef.current) seriesRef.current.removePriceLine(putLineRef.current); } catch (e) {}
        try { if (flipLineRef.current) seriesRef.current.removePriceLine(flipLineRef.current); } catch (e) {}
        try { if (topStrikeLineRef.current) seriesRef.current.removePriceLine(topStrikeLineRef.current); } catch (e) {}

        if (walls.callWall) {
            callLineRef.current = seriesRef.current.createPriceLine({
                price: walls.callWall,
                color: 'rgba(239, 68, 68, 0.8)',
                lineWidth: 2,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'CALL WALL',
            });
        }

        if (walls.putWall) {
            putLineRef.current = seriesRef.current.createPriceLine({
                price: walls.putWall,
                color: 'rgba(16, 185, 129, 0.8)',
                lineWidth: 2,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'PUT WALL',
            });
        }

        if (walls.gammaFlip) {
            flipLineRef.current = seriesRef.current.createPriceLine({
                price: walls.gammaFlip,
                color: 'rgba(234, 179, 8, 0.8)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: 'GAMMA FLIP',
            });
        }

        if (walls.topStrike) {
            topStrikeLineRef.current = seriesRef.current.createPriceLine({
                price: walls.topStrike,
                color: 'rgba(56, 189, 248, 0.5)', // Subtle Sky Blue
                lineWidth: 1,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: 'TOP GEX',
            });
        }

        return () => {
            if (seriesRef.current) {
                try { if (callLineRef.current) seriesRef.current.removePriceLine(callLineRef.current); } catch (e) {}
                try { if (putLineRef.current) seriesRef.current.removePriceLine(putLineRef.current); } catch (e) {}
                try { if (flipLineRef.current) seriesRef.current.removePriceLine(flipLineRef.current); } catch (e) {}
                try { if (topStrikeLineRef.current) seriesRef.current.removePriceLine(topStrikeLineRef.current); } catch (e) {}
            }
        }
    }, [walls]);

    // Update markers if walls or macro bias change
    useEffect(() => {
        if (fullDataRef.current.length > 0) {
            updateMarkers(fullDataRef.current);
        }
    }, [walls, macroBias]);

    return (
        <div className="w-full relative flex flex-col">
            {/* Header Controls */}
            <div className="flex items-center justify-between bg-[#1e222d] border-b border-white/5 px-4 py-2">
                <div className="flex items-center space-x-4">
                    <span className="text-sm font-black text-white italic tracking-tighter uppercase">{symbol}</span>
                    <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                        {['1M', '5M', '15M', '30M', '1H', '1D'].map((tf) => (
                            <button
                                key={tf}
                                onClick={() => onTimeframeChange(tf)}
                                className={`
                                    px-3 py-1 text-[10px] rounded font-black transition-all uppercase tracking-widest
                                    ${timeframe === tf
                                        ? 'bg-accent/10 text-accent border border-accent/20'
                                        : 'text-ink-tertiary hover:text-white hover:bg-white/5'}
                                `}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex items-center space-x-3">
                    {/* Active SMA indicators as small labels */}
                    {activeSMAs.map(ind => (
                        <div key={ind.id} className="flex items-center space-x-1">
                            <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: ind.color }} />
                            <span className="text-[9px] font-bold text-ink-muted">SMA {ind.period}</span>
                        </div>
                    ))}
                    
                    {/* Active Reversion indicators with real-time distance */}
                    {activeReversions.map(ind => (
                        <div key={ind.id} className="flex items-center space-x-1 px-2 py-0.5 bg-black/40 rounded border border-white/5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }} />
                            <span className="text-[9px] font-bold text-ink-muted uppercase">REV {ind.period}:</span>
                            <span className={`text-[10px] font-black data-font ${
                                Math.abs(reversionDistances[ind.id] || 0) >= 1.5 ? 'text-red-400 animate-pulse' : 
                                Math.abs(reversionDistances[ind.id] || 0) >= 0.8 ? 'text-yellow-400' : 'text-emerald-400'
                            }`}>
                                {reversionDistances[ind.id] > 0 ? '+' : ''}{reversionDistances[ind.id]?.toFixed(2) || '0.00'}%
                            </span>
                        </div>
                    ))}

                    {/* Trend Pullback bias badge */}
                    {activeTrend.length > 0 && macroBias && (
                        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border ${
                            macroBias.direction === 'BULLISH' ? 'bg-cyan-500/10 border-cyan-500/30' :
                            macroBias.direction === 'BEARISH' ? 'bg-orange-500/10 border-orange-500/30' :
                            'bg-white/5 border-white/10'
                        }`}>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                                macroBias.direction === 'BULLISH' ? 'text-cyan-400' :
                                macroBias.direction === 'BEARISH' ? 'text-orange-400' :
                                'text-ink-muted'
                            }`}>
                                {macroBias.direction === 'BULLISH' ? '⇈ TREND ↑' : 
                                 macroBias.direction === 'BEARISH' ? '⇊ TREND ↓' : '— NEUTRAL'}
                            </span>
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                                macroBias.confluences >= 3 ? 'bg-green-500/20 text-green-400' :
                                macroBias.confluences >= 2 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-white/10 text-ink-muted'
                            }`}>
                                {macroBias.confluences}/3
                            </span>
                        </div>
                    )}

                    {activeRSIs.length > 0 && (
                        <div className="flex items-center space-x-1">
                            <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: activeRSIs[0].color }} />
                            <span className="text-[9px] font-bold text-ink-muted">RSI {activeRSIs[0].period}</span>
                        </div>
                    )}

                    {walls && (
                        <div className="flex items-center space-x-4 border-l border-white/10 pl-3">
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] text-ink-muted uppercase font-bold tracking-widest">Call Wall</span>
                                <span className="text-xs font-black text-red-500 data-font">${walls.callWall.toFixed(0)}</span>
                            </div>
                            <div className="flex flex-col items-end border-l border-white/10 pl-4">
                                <span className="text-[8px] text-ink-muted uppercase font-bold tracking-widest">Put Wall</span>
                                <span className="text-xs font-black text-emerald-500 data-font">${walls.putWall.toFixed(0)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Candlestick Chart */}
            <div ref={chartContainerRef} className="w-full flex-grow bg-[#0b0e11]" style={{ minHeight: hasRSI ? '460px' : '600px' }} />

            {/* RSI Panel */}
            {hasRSI && (
                <div className="w-full relative border-t border-white/5">
                    {/* RSI Label */}
                    <div className="absolute top-2 left-3 z-10 flex items-center space-x-2">
                        <span className="text-[9px] font-black text-ink-muted uppercase tracking-widest bg-[#0b0e11]/80 backdrop-blur-sm px-2 py-0.5 rounded">
                            RSI ({activeRSIs[0]?.period || 14})
                        </span>
                    </div>
                    {/* Overbought / Oversold zone labels */}
                    <div className="absolute top-2 right-14 z-10 flex items-center space-x-3">
                        <span className="text-[8px] font-bold text-red-400/60">OB 70</span>
                        <span className="text-[8px] font-bold text-emerald-400/60">OS 30</span>
                    </div>
                    <div ref={rsiContainerRef} className="w-full bg-[#0b0e11]" style={{ height: '150px' }} />
                </div>
            )}
        </div>
    );
});

CandleChart.displayName = 'CandleChart';
