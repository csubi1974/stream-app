import React, { useMemo } from 'react';
import { Gauge } from 'lucide-react';

interface MarketSentimentGaugeProps {
    value: number; // 0 to 100
    label: string;
}

export function MarketSentimentGauge({ value, label }: MarketSentimentGaugeProps) {
    const color = useMemo(() => {
        if (value < 30) return 'text-red-500';
        if (value < 45) return 'text-orange-500';
        if (value < 55) return 'text-yellow-500';
        if (value < 70) return 'text-blue-500';
        return 'text-green-500';
    }, [value]);

    const description = useMemo(() => {
        const isVIX = label.toLowerCase().includes('vix');
        if (isVIX) {
            if (value < 30) return "Pánico Extremo. La volatilidad implícita es muy alta, lo que obliga a los dealers a ser agresivos en sus coberturas.";
            if (value < 50) return "Miedo moderado. El mercado está cauteloso, esperando catalizadores.";
            if (value < 70) return "Ambiente constructivo. Volatilidad controlada ideal para estrategias alcistas.";
            return "Complacencia Extrema. El mercado está sobrecomprado y el riesgo de una reversión rápida ha aumentado.";
        } else {
            // Price Drift Momentum
            if (value < 40) return "Momentum bajista fuerte. El precio está perdiendo niveles clave rápidamente.";
            if (value < 50) return "Drift negativo ligero. El mercado está buscando soporte.";
            if (value < 60) return "Momentum neutral/positivo. Consolidación sana por encima de medias.";
            return "Tendencia alcista acelerada. El momentum es fuerte y los compradores tienen el control total.";
        }
    }, [value, label]);

    const rotation = (value / 100) * 180 - 90;

    return (
        <div className="group relative glass-surface rounded-xl p-5 border border-white/[0.08] hover:border-white/[0.15] transition-all duration-300 flex flex-col items-center justify-center">
            {/* Tooltip */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full w-56 p-3 bg-gray-950 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-[10px] text-ink-secondary text-center leading-relaxed">
                <div className="font-black text-accent mb-2 uppercase tracking-wider border-b border-white/10 pb-1 text-[9px]">{label}</div>
                {description}
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-950"></div>
            </div>

            <div className="flex items-center space-x-2 mb-4">
                <div className="p-1 bg-white/5 rounded">
                    <Gauge className="w-3 h-3 text-ink-muted" />
                </div>
                <span className="text-[9px] font-black text-ink-tertiary uppercase tracking-[0.2em]">{label}</span>
            </div>

            <div className="relative w-32 h-16 overflow-hidden">
                {/* Semi-circle background */}
                <div className="absolute top-0 left-0 w-32 h-32 rounded-full border-[10px] border-white/5 scale-y-[1] translate-y-0"></div>

                {/* Colored arc */}
                <svg className="absolute top-0 left-0 w-32 h-16" viewBox="0 0 128 64">
                    <path
                        d="M 10 64 A 54 54 0 0 1 118 64"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeLinecap="round"
                        className={`${color} opacity-20`}
                    />
                    <path
                        d="M 10 64 A 54 54 0 0 1 118 64"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${(value / 100) * 169} 169`}
                        className={color}
                        style={{
                            filter: 'drop-shadow(0 0 4px currentColor)'
                        }}
                    />
                </svg>

                {/* Needle */}
                <div
                    className="absolute bottom-0 left-1/2 w-1 h-12 bg-white origin-bottom rounded-full transition-transform duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
                ></div>
                <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-base border-2 border-white rounded-full -translate-x-1/2 translate-y-1/2 z-10 shadow-[0_0_8px_rgba(255,255,255,0.3)]"></div>
            </div>

            <div className="mt-3 text-center">
                <span className={`text-3xl font-black data-font tracking-tighter ${color}`}>
                    {value != null ? value.toFixed(0) : '--'}
                </span>
                <span className="text-ink-tertiary text-[9px] ml-1.5 uppercase font-bold tracking-widest">Index</span>
            </div>

            <div className="flex justify-between w-full mt-2 px-2">
                <span className="text-[8px] text-negative/60 font-black uppercase tracking-wider">Panic</span>
                <span className="text-[8px] text-positive/60 font-black uppercase tracking-wider">Greed</span>
            </div>
        </div>
    );
}
