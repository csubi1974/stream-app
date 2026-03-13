import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header';
import { CandleChart, CandleChartHandle } from '../components/charts/CandleChart';
import { IndicatorPanel, ActiveIndicator } from '../components/charts/indicators/IndicatorPanel';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Activity, Target, Shield, TrendingUp, Zap, BarChart3, Clock, Lock } from 'lucide-react';
import { useMarketStore } from '../stores/marketStore';

export function MarketChart() {
    const { t } = useTranslation();
    const { 
        selectedSymbol, 
        setSelectedSymbol,
        chartTimeframe,
        setChartTimeframe,
        activeIndicators,
        setActiveIndicators
    } = useMarketStore();
    const chartRef = useRef<CandleChartHandle>(null);
    const lastPriceRef = useRef<number>(0);
    const lastHistoryTimeRef = useRef<number>(0);
    const [levels, setLevels] = useState<{ callWall: number; putWall: number; gammaFlip: number; regime: string } | null>(null);
    const [livePrice, setLivePrice] = useState<number>(0);
    const [isSchwabConnected, setIsSchwabConnected] = useState<boolean>(true);
    
    // Live candle aggregation
    const currentBarRef = useRef<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
    } | null>(null);

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

    const { isConnected, sendMessage, lastMessage } = useWebSocket({
        url: wsUrl,
        onConnect: () => {
            console.log('📡 Chart: Connected to market data stream');
            const symbol = selectedSymbol || 'SPX';
            const subSymbol = symbol === 'SPX' ? '$SPX' : symbol;
            sendMessage({
                type: 'subscribe',
                symbols: [subSymbol]
            });
        }
    });

    // ────────────────────────────────────────────
    // LIVE UPDATES: Process incoming WebSocket data
    // ────────────────────────────────────────────
    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'option_trade') return;

        const trade = lastMessage.data;
        const effectiveSymbol = selectedSymbol || 'SPX';
        const targetMatch = effectiveSymbol === 'SPX' ? '$SPX' : effectiveSymbol;
        
        if (trade.symbol !== targetMatch) return;

        const price = Number(trade.price);
        if (!price || isNaN(price)) return;
        
        setLivePrice(price);
        
        // Calculate bar time based on selected timeframe
        const now = trade.timestamp ? new Date(trade.timestamp).getTime() : Date.now();
        const epochSeconds = Math.floor(now / 1000);
        
        let intervalSec = 300; // 5M default
        switch (chartTimeframe) {
            case '1M':  intervalSec = 60; break;
            case '5M':  intervalSec = 300; break;
            case '15M': intervalSec = 900; break;
            case '30M': intervalSec = 1800; break;
            case '1H':  intervalSec = 3600; break;
            case '1D':  intervalSec = 86400; break;
        }

        const barTime = Math.floor(epochSeconds / intervalSec) * intervalSec;
        
        // GUARD: Don't push bars older than the last historical candle
        if (lastHistoryTimeRef.current > 0 && barTime < lastHistoryTimeRef.current) {
            return;
        }

        // Aggregate OHLC for the current bar
        if (!currentBarRef.current || currentBarRef.current.time !== barTime) {
            currentBarRef.current = {
                time: barTime,
                open: price,
                high: price,
                low: price,
                close: price
            };
        } else {
            currentBarRef.current.high = Math.max(currentBarRef.current.high, price);
            currentBarRef.current.low = Math.min(currentBarRef.current.low, price);
            currentBarRef.current.close = price;
        }

        // Push to chart
        if (chartRef.current) {
            chartRef.current.updateCandle(currentBarRef.current);
        }
        
        lastPriceRef.current = price;
    }, [lastMessage, selectedSymbol, chartTimeframe]);

    // ────────────────────────────────────────────
    // FETCH GEX LEVELS & HEALTH CHECK
    // ────────────────────────────────────────────
    useEffect(() => {
        const fetchLevels = async () => {
            try {
                const symbol = selectedSymbol || 'SPX';
                const response = await fetch(`/api/gex/metrics?symbol=${symbol}`);
                const data = await response.json();
                if (data && !data.error) {
                    setLevels({
                        callWall: data.callWall,
                        putWall: data.putWall,
                        gammaFlip: data.gammaFlip,
                        regime: data.regime
                    });
                    if (data.currentPrice && lastPriceRef.current === 0) {
                        setLivePrice(data.currentPrice);
                        lastPriceRef.current = data.currentPrice;
                    }
                }
            } catch (error) {
                console.error("Failed to fetch levels", error);
            }
        };

        const checkHealth = async () => {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                setIsSchwabConnected(!!data.schwab_connected);
            } catch (e) {
                console.error("Health check failed", e);
            }
        };

        checkHealth();
        fetchLevels();
        const interval = setInterval(() => {
            fetchLevels();
            checkHealth();
        }, 30000);
        return () => clearInterval(interval);
    }, [selectedSymbol]);

    // ────────────────────────────────────────────
    // SUBSCRIBE/UNSUBSCRIBE on symbol change
    // ────────────────────────────────────────────
    useEffect(() => {
        const symbol = selectedSymbol || 'SPX';
        const subSymbol = symbol === 'SPX' ? '$SPX' : symbol;
        
        // Reset live aggregation
        currentBarRef.current = null;
        lastHistoryTimeRef.current = 0;
        
        if (isConnected) {
            sendMessage({ type: 'subscribe', symbols: [subSymbol] });
        }
        
        return () => {
            if (isConnected) {
                sendMessage({ type: 'unsubscribe', symbols: [subSymbol] });
            }
        };
    }, [selectedSymbol, isConnected]);

    // ────────────────────────────────────────────
    // CALLBACK: When CandleChart loads history
    // ────────────────────────────────────────────
    const handleDataLoaded = (lastTime: number) => {
        console.log(`📊 History synced. Last bar: ${new Date(lastTime * 1000).toISOString()}`);
        lastHistoryTimeRef.current = lastTime;
        currentBarRef.current = null; // Reset so the next live tick starts a fresh bar
    };

    // Indicator handlers
    const handleAddIndicator = (indicator: ActiveIndicator) => {
        setActiveIndicators(prev => [...prev, indicator]);
    };

    const handleRemoveIndicator = (id: string) => {
        setActiveIndicators(prev => prev.filter(ind => ind.id !== id));
    };

    const handleUpdateIndicator = (id: string, updates: Partial<ActiveIndicator>) => {
        setActiveIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind));
    };

    return (
        <div className="min-h-screen bg-[#0b0e11] text-white flex flex-col">
            <Header />
            
            <main className="flex-grow flex flex-col max-w-[1800px] mx-auto w-full px-4 py-6">
                {/* Dashboard Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 relative z-50">
                    <div className="flex items-center space-x-6">
                        <div className="p-3 bg-accent/10 rounded-2xl border border-accent/20">
                            <Activity className="h-6 w-6 text-accent" />
                        </div>
                        <div className="flex items-center space-x-6">
                            <div>
                                <h1 className="text-xl font-black uppercase tracking-tighter italic flex items-center space-x-2">
                                    <span>{selectedSymbol || 'SPX'}</span>
                                    <span className="text-accent">Live Terminal</span>
                                </h1>
                                <div className="flex items-center space-x-2 text-[10px] text-ink-tertiary font-bold uppercase tracking-widest">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-positive animate-pulse' : 'bg-negative'}`}></span>
                                    <span>{isConnected ? 'Stream Active' : 'Disconnected'}</span>
                                    <span className="mx-2">•</span>
                                    <Clock className="h-3 w-3" />
                                    <span>
                                        {new Date().toLocaleTimeString('en-US', { 
                                            timeZone: 'America/New_York', 
                                            hour12: false, 
                                            hour: '2-digit', 
                                            minute: '2-digit'
                                        })} ET
                                    </span>
                                </div>
                            </div>

                            <div className="hidden md:flex items-center space-x-6 border-l border-white/10 pl-6">
                                <TopLevelItem label="Call Wall" value={levels?.callWall} color="text-red-500" />
                                <TopLevelItem label="Put Wall" value={levels?.putWall} color="text-emerald-500" />
                                <TopLevelItem label="Gamma Flip" value={levels?.gammaFlip} color="text-yellow-500" />
                            </div>

                            <div className="h-10 w-px bg-white/10 hidden md:block" />

                            <div className="hidden md:block transition-all hover:scale-105 bg-white/[0.05] px-4 py-2 rounded-xl border border-white/10">
                                <span className="text-[10px] text-ink-muted uppercase font-bold tracking-widest block">Spot Price</span>
                                <span className="text-2xl font-black text-white data-font tracking-tighter">
                                    ${livePrice ? livePrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '--.--'}
                                </span>
                            </div>
                        </div>
                    </div>

                        <div className="flex items-center space-x-2 bg-white/[0.03] p-1 rounded-xl border border-white/5 backdrop-blur-md relative z-50">
                            <IndicatorPanel 
                                activeIndicators={activeIndicators}
                                onAddIndicator={handleAddIndicator}
                                onRemoveIndicator={handleRemoveIndicator}
                                onUpdateIndicator={handleUpdateIndicator}
                            />
                            
                            <div className="w-px h-6 bg-white/10 mx-1" />

                            {['SPX', 'SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA'].map((sym) => (
                                <button
                                    key={sym}
                                    onClick={() => setSelectedSymbol(sym)}
                                    className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-[0.2em] ${
                                    ((selectedSymbol === sym) || (!selectedSymbol && sym === 'SPX'))
                                        ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_0_15px_rgba(0,242,255,0.1)]'
                                        : 'text-ink-tertiary hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {sym}
                            </button>
                        ))}
                    </div>
                </div>

                {!isSchwabConnected && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Shield className="h-5 w-5 text-red-400" />
                            <div>
                                <p className="text-sm font-bold text-white">Schwab API Disconnected</p>
                                <p className="text-xs text-red-400/80">Real-time data and history are unavailable. Please go to settings to authenticate.</p>
                            </div>
                        </div>
                        <Link to="/settings" className="px-4 py-2 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-all">
                            Connect API
                        </Link>
                    </div>
                )}

                {/* Main Content: Chart + Sidebar */}
                <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Chart Container */}
                    <div className="lg:col-span-9 flex flex-col min-h-[600px] border border-white/[0.05] rounded-3xl overflow-hidden glass-surface shadow-2xl">
                        <CandleChart 
                            ref={chartRef} 
                            symbol={(!selectedSymbol || selectedSymbol === 'SPX') ? '$SPX' : selectedSymbol}
                            timeframe={chartTimeframe}
                            onTimeframeChange={setChartTimeframe}
                            onDataLoaded={handleDataLoaded}
                            activeIndicators={activeIndicators}
                        />
                    </div>

                    {/* Right: Insights & GEX */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Summary Widget */}
                        <div className="glass-surface rounded-2xl p-6 border border-white/5 space-y-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <Zap className="h-4 w-4 text-yellow-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-ink-tertiary">Engine Insights</span>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                                    <div className="text-[9px] text-ink-muted uppercase font-bold tracking-widest mb-1">Market Sentiment</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-black text-white italic">
                                            {levels?.regime === 'stable' ? 'INSTITUTIONAL BULLISH' : 'INCREASED VOLATILITY'}
                                        </span>
                                        {levels?.regime === 'stable' ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <BarChart3 className="h-5 w-5 text-red-400" />}
                                    </div>
                                </div>

                                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                                    <div className="text-[9px] text-ink-muted uppercase font-bold tracking-widest mb-1">Volatility Regime</div>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-lg font-black italic font-mono uppercase tracking-tighter ${
                                            levels?.regime === 'stable' ? 'text-emerald-400' : 'text-red-400'
                                        }`}>
                                            {levels?.regime === 'stable' ? 'STABLE / COMPRESSION' : 'HIGH VOL / EXPANSION'}
                                        </span>
                                        <Shield className={`h-5 w-5 ${levels?.regime === 'stable' ? 'text-emerald-400' : 'text-red-400'}`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Levels */}
                        <div className="glass-surface rounded-2xl p-6 border border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-tertiary mb-4 border-b border-white/5 pb-2">Structural Levels</h3>
                            <div className="space-y-4">
                                <LevelRow 
                                    label="Call Wall" 
                                    color="text-red-400" 
                                    icon={<Lock className="h-3 w-3" />} 
                                    value={levels?.callWall ? levels.callWall.toFixed(0) : '...'} 
                                />
                                <LevelRow 
                                    label="Gamma Flip" 
                                    color="text-yellow-400" 
                                    icon={<BarChart3 className="h-3 w-3" />} 
                                    value={levels?.gammaFlip ? levels.gammaFlip.toFixed(2) : '...'} 
                                />
                                <LevelRow 
                                    label="Put Wall" 
                                    color="text-emerald-400" 
                                    icon={<Shield className="h-3 w-3" />} 
                                    value={levels?.putWall ? levels.putWall.toFixed(0) : '...'} 
                                />
                            </div>
                        </div>

                        {/* Trade Logic Visualizer */}
                        <div className="glass-surface rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Target className="h-16 w-16 text-accent" />
                            </div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-tertiary mb-2">Trade Scenario</h3>
                            <p className="text-xs text-ink-secondary leading-relaxed mb-4">
                                {levels?.regime === 'stable' 
                                    ? `Price is in positive GEX territory. Fades are likely to be bought near the Put Wall at ${levels?.putWall?.toFixed(0) || '...'}.`
                                    : `High volatility regime detected. Price is below Gamma Flip (${levels?.gammaFlip?.toFixed(0) || '...'}). Expect rapid movements.`
                                }
                            </p>
                            <button className="w-full py-2 bg-accent/10 border border-accent/30 rounded-lg text-[10px] font-black text-accent uppercase tracking-[0.2em] hover:bg-accent/20 transition-all">
                                Analyze Flow Detail
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function TopLevelItem({ label, value, color }: { label: string, value: number | undefined, color: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[8px] text-ink-muted uppercase font-black tracking-[0.2em]">{label}</span>
            <span className={`text-sm font-black data-font ${color}`}>
                {value ? `$${value.toFixed(0)}` : '---'}
            </span>
        </div>
    );
}

function LevelRow({ label, value, color, icon }: { label: string, value: string, color: string, icon: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <div className={`p-1 rounded-md bg-white/5 ${color}`}>
                    {icon}
                </div>
                <span className="text-[10px] text-ink-secondary font-bold uppercase tracking-wider">{label}</span>
            </div>
            <span className={`text-xs font-black data-font ${color}`}>{value}</span>
        </div>
    );
}
