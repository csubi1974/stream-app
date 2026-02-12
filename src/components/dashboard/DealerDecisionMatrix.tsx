import React, { useMemo } from 'react';
import { Shield, Zap, AlertTriangle, Target, RefreshCw } from 'lucide-react';

interface Scenario {
    id: string;
    name: string;
    dex: 'pos' | 'neg' | 'zero';
    gex: 'pos' | 'neg' | 'zero';
    vex: 'pos' | 'neg' | 'zero';
    description: string;
    action: string;
    color: string;
    icon: any;
}

const SCENARIOS: Scenario[] = [
    {
        id: 'squeeze',
        name: 'Aceleración Alcista',
        dex: 'pos', gex: 'neg', vex: 'pos',
        description: '"Squeeze": Dealers venden puts y compran calls. El precio sube y la volatilidad lo acelera.',
        action: 'Compra Calls.',
        color: 'text-green-400',
        icon: Zap
    },
    {
        id: 'grind',
        name: 'Subida Tranquila',
        dex: 'pos', gex: 'pos', vex: 'pos',
        description: '"Grind Up": Los dealers amortiguan el movimiento pero compran en los dips.',
        action: 'Bull Put Spreads.',
        color: 'text-emerald-500',
        icon: TrendingUpIcon
    },
    {
        id: 'crash',
        name: 'Riesgo de Crash',
        dex: 'neg', gex: 'neg', vex: 'neg',
        description: '"Cascada": Dealers necesitan vender mientras el precio cae y la IV sube.',
        action: 'Compra Puts.',
        color: 'text-red-500',
        icon: AlertTriangle
    },
    {
        id: 'magnet',
        name: 'Rango / Theta',
        dex: 'zero', gex: 'pos', vex: 'zero',
        description: '"Magneto": El precio está atrapado. Los dealers venden volatilidad.',
        action: 'Iron Condors / 0DTE Credit Spreads.',
        color: 'text-blue-400',
        icon: Target
    },
    {
        id: 'fakeout',
        name: 'Trampa de Volatilidad',
        dex: 'neg', gex: 'pos', vex: 'neg',
        description: '"Fake Out": El precio cae pero los dealers frenan la caída.',
        action: 'Posible Reversal Alcista.',
        color: 'text-orange-400',
        icon: RefreshCw
    }
];

function TrendingUpIcon(props: any) {
    return <path d="M22 7L13.5 15.5L8.5 10.5L2 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" {...props} />;
}

interface DealerDecisionMatrixProps {
    netDex: number;
    netGex: number;
    netVex: number;
}

export function DealerDecisionMatrix({ netDex, netGex, netVex }: DealerDecisionMatrixProps) {
    const currentScenarioId = useMemo(() => {
        // Umbrales mejorados: GEX es la prioridad #1
        const isGexZero = Math.abs(netGex) < 500000;
        const isDexZero = Math.abs(netDex) < 1000000;
        const isVexZero = Math.abs(netVex) < 500000;

        const g = isGexZero ? 'zero' : (netGex > 0 ? 'pos' : 'neg');
        const d = isDexZero ? 'zero' : (netDex > 0 ? 'pos' : 'neg');
        const v = isVexZero ? 'zero' : (netVex > 0 ? 'pos' : 'neg');

        // 1. Prioridad: GEX NEGATIVO (Aceleración / Riesgo)
        if (g === 'neg') {
            if (d === 'pos') return 'squeeze'; // DEX (+) vs GEX (-) = Squeeze alcista
            if (d === 'neg') return 'crash';   // DEX (-) vs GEX (-) = Desplome / Caída libre
            return 'crash'; // Si GEX es negativo, el riesgo es dominante
        }

        // 2. Prioridad: GEX POSITIVO (Estabilidad)
        if (g === 'pos') {
            if (d === 'pos') return 'grind';   // Subida con red de seguridad
            if (d === 'neg') return 'fakeout'; // Caída con freno de mano (posible rebote)
            return 'magnet'; // Si DEX es neutral pero GEX es positivo, estamos atrapados en un strike
        }

        // 3. Prioridad: GEX NEUTRAL (Incertidumbre)
        if (d === 'pos') return 'grind';
        if (d === 'neg') return 'fakeout';

        return 'magnet'; // Por defecto si todo es neutral
    }, [netDex, netGex, netVex]);

    const activeScenario = SCENARIOS.find(s => s.id === currentScenarioId) || SCENARIOS[3];

    return (
        <div className="glass-surface rounded-xl overflow-hidden border border-white/[0.08]">
            <div className="px-5 py-3 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-accent/10 rounded-lg">
                        <Shield className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Estado del Dealer & Matriz de Decisión</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-lg border border-white/5">
                        <div className={`w-2 h-2 rounded-full ${netDex >= 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                        <span className="text-[9px] font-black text-ink-tertiary uppercase tracking-wider">DEX</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-lg border border-white/5">
                        <div className={`w-2 h-2 rounded-full ${netGex >= 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                        <span className="text-[9px] font-black text-ink-tertiary uppercase tracking-wider">GEX</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-lg border border-white/5">
                        <div className={`w-2 h-2 rounded-full ${netVex >= 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                        <span className="text-[9px] font-black text-ink-tertiary uppercase tracking-wider">VEX</span>
                    </div>
                </div>
            </div>

            <div className="p-5">
                {/* Active Scenario Highlight */}
                <div className="flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border-l-4 border-accent mb-6 shadow-inner">
                    <div className={`p-3 rounded-xl bg-white/5 ${activeScenario.color}`}>
                        <activeScenario.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className={`text-lg font-black uppercase tracking-tight ${activeScenario.color}`}>
                                {activeScenario.name}
                            </h3>
                            <span className="text-[9px] font-black bg-accent/10 px-3 py-1 rounded-lg text-accent uppercase tracking-widest border border-accent/20">
                                Escenario Actual
                            </span>
                        </div>
                        <p className="text-ink-secondary text-sm font-medium leading-relaxed italic mb-3">
                            {activeScenario.description}
                        </p>
                        <div className="flex items-center gap-3 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                            <span className="text-[9px] font-black text-ink-tertiary uppercase tracking-widest">Acción Recomendada:</span>
                            <span className="text-sm font-black text-white">{activeScenario.action}</span>
                        </div>
                    </div>
                </div>

                {/* Matrix Reference (Mini Version) */}
                <div className="grid grid-cols-1 gap-2">
                    {SCENARIOS.map((s) => (
                        <div
                            key={s.id}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-[11px] transition-all ${s.id === currentScenarioId
                                ? 'bg-accent/10 border border-accent/20 shadow-[0_0_12px_rgba(0,242,255,0.1)]'
                                : 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100 border border-white/5 hover:border-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-3 w-44">
                                <div className={`w-2 h-2 rounded-full ${s.dex === 'pos' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' :
                                    s.dex === 'neg' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]' :
                                        'bg-gray-600'
                                    }`}></div>
                                <div className={`w-2 h-2 rounded-full ${s.gex === 'pos' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' :
                                    s.gex === 'neg' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]' :
                                        'bg-gray-600'
                                    }`}></div>
                                <div className={`w-2 h-2 rounded-full ${s.vex === 'pos' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' :
                                    s.vex === 'neg' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]' :
                                        'bg-gray-600'
                                    }`}></div>
                                <span className="font-black uppercase tracking-tight text-white text-[10px]">{s.name}</span>
                            </div>
                            <span className="text-ink-tertiary font-medium truncate ml-4 flex-1 text-[10px]">{s.description}</span>
                            <span className="font-black text-white ml-2 text-right text-[10px]">{s.action.split('.')[0]}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
