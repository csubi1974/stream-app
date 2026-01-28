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
            <div className="w-full bg-black/80 border-y border-gray-800 backdrop-blur-md h-10 flex items-center px-4 overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent z-10 flex items-center pl-4">
                    <div className="flex items-center space-x-2">
                        <Zap className="w-3 h-3 text-gray-600" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Institutional Flow</span>
                    </div>
                </div>
                <div className="pl-36 text-[10px] font-black text-gray-700 uppercase tracking-widest animate-pulse">
                    Awaiting live streaming flow data...
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-black/80 border-y border-gray-800 backdrop-blur-md h-10 overflow-hidden flex items-center relative group">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent z-10 flex items-center pl-4">
                <div className="flex items-center space-x-2">
                    <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500 animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Institutional Flow</span>
                </div>
            </div>

            <div className="flex whitespace-nowrap animate-scroll items-center h-full">
                {[...entries, ...entries].map((entry, idx) => (
                    <div
                        key={`${entry.id}-${idx}`}
                        className="inline-flex items-center space-x-3 px-6 border-r border-gray-800 h-full hover:bg-white/5 transition-colors cursor-default"
                    >
                        <span className="text-[10px] font-mono text-gray-500">{entry.timestamp}</span>
                        <span className="text-sm font-black text-white">{entry.symbol}</span>
                        <div className="flex items-center space-x-1">
                            {entry.strike > 0 && (
                                <span className="text-xs font-bold text-gray-400">{entry.strike}</span>
                            )}
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${entry.type === 'CALL' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                                }`}>
                                {entry.type}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className={`text-xs font-bold ${entry.side === 'BUY' ? 'text-green-500' : entry.side === 'SELL' ? 'text-red-500' : 'text-gray-400'}`}>
                                {entry.side === 'BUY' ? <TrendingUp className="w-3 h-3 inline mr-1" /> : entry.side === 'SELL' ? <TrendingDown className="w-3 h-3 inline mr-1" /> : null}
                                {entry.size}
                            </span>
                            {entry.flags?.includes('SWEEP') && (
                                <span className="bg-blue-900/40 text-blue-400 text-[8px] font-black px-1 rounded border border-blue-500/30 flex items-center">
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
