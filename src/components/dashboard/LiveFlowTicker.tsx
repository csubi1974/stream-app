import React, { useRef } from 'react';
import { Zap, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useMarketStore } from '../../stores/marketStore';

interface TapeEntry {
    id: string;
    symbol: string;
    strike: number;
    type: 'CALL' | 'PUT';
    price: number;
    size: number;
    timestamp: string;
    side: 'BUY' | 'SELL';
    flags?: string[];
}

export function LiveFlowTicker() {
    const activeTrades = useMarketStore(state => state.activeTrades);

    // Transform store trades to TapeEntry format
    const entries = activeTrades.map(trade => {
        // Parse symbol like "$SPXW 260128C05500000"
        let strike = 0;
        let type: 'CALL' | 'PUT' = 'CALL';
        let displaySymbol = trade.symbol;

        // Strip the "$" if present for cleaner display
        if (displaySymbol.startsWith('$')) displaySymbol = displaySymbol.substring(1);

        // Simple regex to extract strike and type from standard OSI symbols
        const osiMatch = trade.symbol.match(/(\d{6})([CP])(\d{8})/);
        if (osiMatch) {
            type = osiMatch[2] === 'C' ? 'CALL' : 'PUT';
            strike = parseInt(osiMatch[3]) / 1000;
            // Get root symbol, e.g., "SPXW"
            displaySymbol = trade.symbol.split(' ')[0].replace('$', '');
        }

        return {
            id: trade.timestamp + trade.symbol + trade.price + Math.random(),
            symbol: displaySymbol,
            strike: strike,
            type: type,
            price: trade.price,
            size: trade.size,
            timestamp: trade.timestamp,
            side: trade.side as 'BUY' | 'SELL',
            flags: trade.size >= 100 ? ['SWEEP'] : []
        };
    });

    // Fallback if no entries yet
    if (entries.length === 0) {
        return (
            <div className="w-full bg-base/95 backdrop-blur-xl border-y border-white/[0.05] h-12 flex items-center px-6 overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-base via-base/80 to-transparent z-10 flex items-center pl-6">
                    <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-accent/10 rounded-md">
                            <Zap className="w-3 h-3 text-accent/40 animate-pulse" />
                        </div>
                        <span className="text-[9px] font-black text-ink-tertiary uppercase tracking-[0.25em]">Institutional Flow</span>
                    </div>
                </div>
                <div className="pl-44 text-[9px] font-bold text-ink-tertiary uppercase tracking-widest animate-pulse">
                    Awaiting live streaming flow data...
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-base/95 backdrop-blur-xl border-y border-white/[0.05] h-12 overflow-hidden flex items-center relative group shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-base via-base/90 to-transparent z-10 flex items-center pl-6">
                <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-accent/10 rounded-md shadow-[0_0_12px_rgba(0,242,255,0.15)]">
                        <Zap className="w-3 h-3 text-accent fill-accent/50 animate-pulse" />
                    </div>
                    <span className="text-[9px] font-black text-white uppercase tracking-[0.25em]">Institutional Flow</span>
                </div>
            </div>

            <div className="flex whitespace-nowrap animate-scroll items-center h-full">
                {[...entries, ...entries].map((entry, idx) => (
                    <div
                        key={`${entry.id}-${idx}`}
                        className="inline-flex items-center space-x-4 px-6 border-r border-white/[0.05] h-full hover:bg-white/[0.03] transition-all cursor-default group/item"
                    >
                        <span className="text-[9px] data-font text-ink-tertiary font-medium">{entry.timestamp}</span>
                        <span className="text-sm font-black text-white tracking-tight">{entry.symbol}</span>
                        <div className="flex items-center space-x-2">
                            {entry.strike > 0 && (
                                <span className="text-xs font-bold text-ink-secondary data-font">${entry.strike}</span>
                            )}
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${entry.type === 'CALL'
                                ? 'bg-positive/10 text-positive border-positive/20'
                                : 'bg-negative/10 text-negative border-negative/20'
                                }`}>
                                {entry.type}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className={`flex items-center space-x-1 text-xs font-black data-font ${entry.side === 'BUY' ? 'text-positive' :
                                entry.side === 'SELL' ? 'text-negative' : 'text-ink-muted'
                                }`}>
                                {entry.side === 'BUY' ? (
                                    <TrendingUp className="w-3 h-3" />
                                ) : entry.side === 'SELL' ? (
                                    <TrendingDown className="w-3 h-3" />
                                ) : null}
                                <span>{entry.size}</span>
                            </div>
                            {entry.flags?.includes('SWEEP') && (
                                <span className="bg-accent/10 text-accent text-[8px] font-black px-2 py-0.5 rounded-md border border-accent/30 flex items-center shadow-[0_0_8px_rgba(0,242,255,0.1)]">
                                    <Target className="w-2 h-2 mr-1" /> SWEEP
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 60s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
        </div>
    );
}
