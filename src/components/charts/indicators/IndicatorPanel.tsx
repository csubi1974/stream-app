import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, TrendingUp, BarChart3, Plus, Minus, Target, Crosshair } from 'lucide-react';

export interface ActiveIndicator {
    id: string;
    type: 'SMA' | 'RSI' | 'REVERSION' | 'TREND' | 'PURE_REVERSION';
    period: number;
    color: string;
    visible: boolean;
}

interface IndicatorPanelProps {
    activeIndicators: ActiveIndicator[];
    onAddIndicator: (indicator: ActiveIndicator) => void;
    onRemoveIndicator: (id: string) => void;
    onUpdateIndicator: (id: string, updates: Partial<ActiveIndicator>) => void;
}

const INDICATOR_TEMPLATES = [
    {
        type: 'SMA' as const,
        label: 'SMA',
        description: 'Simple Moving Average',
        category: 'Trend',
        icon: TrendingUp,
        defaultPeriod: 20,
        defaultColor: '#3b82f6',
        presets: [
            { period: 8, color: '#f59e0b', label: 'SMA 8 (Fast)' },
            { period: 20, color: '#3b82f6', label: 'SMA 20 (Mid)' },
            { period: 50, color: '#a855f7', label: 'SMA 50 (Slow)' },
            { period: 200, color: '#ec4899', label: 'SMA 200 (Macro)' },
        ],
    },
    {
        type: 'RSI' as const,
        label: 'RSI',
        description: 'Relative Strength Index',
        category: 'Momentum',
        icon: BarChart3,
        defaultPeriod: 14,
        defaultColor: '#a855f7',
        presets: [
            { period: 7, color: '#f59e0b', label: 'RSI 7 (Fast)' },
            { period: 14, color: '#a855f7', label: 'RSI 14 (Standard)' },
            { period: 21, color: '#3b82f6', label: 'RSI 21 (Smooth)' },
        ],
    },
    {
        type: 'REVERSION' as const,
        label: 'Stat Reversion',
        description: 'Empirical Mean Reversion Signals',
        category: 'Algorithm',
        icon: Target,
        defaultPeriod: 8,
        defaultColor: '#10b981',
        presets: [
            { period: 8, color: '#10b981', label: 'Reversion SMA 8 (Scalp)' },
            { period: 20, color: '#3b82f6', label: 'Reversion SMA 20 (Swing)' }
        ],
    },
    {
        type: 'TREND' as const,
        label: 'Trend Pullback',
        description: 'Pro-Trend Signals at GEX + S/R Zones',
        category: 'Algorithm',
        icon: Crosshair,
        defaultPeriod: 1,
        defaultColor: '#f59e0b',
        presets: [
            { period: 1, color: '#f59e0b', label: 'Trend Pullback (Auto)' }
        ],
    },
    {
        type: 'PURE_REVERSION' as const,
        label: 'Reversión Pura',
        description: 'Solo SMA dist + ATR. Sin filtros GEX.',
        category: 'Algorithm',
        icon: Target,
        defaultPeriod: 20,
        defaultColor: '#a78bfa',
        presets: [
            { period: 8, color: '#a78bfa', label: 'Pura SMA 8 (Scalp)' },
            { period: 20, color: '#a78bfa', label: 'Pura SMA 20 (Estadística)' }
        ],
    },
];

const COLORS = ['#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#10b981', '#ef4444', '#06b6d4', '#f97316'];

let idCounter = 0;

export function IndicatorPanel({ activeIndicators, onAddIndicator, onRemoveIndicator, onUpdateIndicator }: IndicatorPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [customPeriod, setCustomPeriod] = useState<{ [type: string]: number }>({});
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddPreset = (type: 'SMA' | 'RSI' | 'REVERSION' | 'TREND' | 'PURE_REVERSION', period: number, color: string) => {
        // Check if same type+period already exists
        const exists = activeIndicators.some(ind => ind.type === type && ind.period === period);
        if (exists) return;

        onAddIndicator({
            id: `${type}_${period}_${++idCounter}`,
            type,
            period,
            color,
            visible: true,
        });
    };

    const handleAddCustom = (type: 'SMA' | 'RSI' | 'REVERSION' | 'TREND' | 'PURE_REVERSION') => {
        const period = customPeriod[type] || INDICATOR_TEMPLATES.find(t => t.type === type)!.defaultPeriod;
        const usedColors = activeIndicators.map(i => i.color);
        const nextColor = COLORS.find(c => !usedColors.includes(c)) || COLORS[0];

        onAddIndicator({
            id: `${type}_${period}_${++idCounter}`,
            type,
            period,
            color: nextColor,
            visible: true,
        });

        setCustomPeriod(prev => ({ ...prev, [type]: 0 }));
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                    ${activeIndicators.length > 0
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'bg-white/5 text-ink-tertiary border border-white/5 hover:text-white hover:bg-white/10'
                    }
                `}
            >
                <BarChart3 className="h-3 w-3" />
                <span>Indicators</span>
                {activeIndicators.length > 0 && (
                    <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-full text-[8px] font-black">
                        {activeIndicators.length}
                    </span>
                )}
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Active Indicators (chips inline) */}
            {activeIndicators.length > 0 && (
                <div className="absolute top-full left-0 mt-1 flex flex-wrap gap-1 z-10">
                    {activeIndicators.map((ind) => (
                        <div
                            key={ind.id}
                            className="flex items-center space-x-1 bg-black/80 backdrop-blur-sm border border-white/10 rounded-md px-2 py-0.5 group"
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }} />
                            <span className="text-[9px] font-bold text-white/70">
                                {ind.type} {ind.period}
                            </span>
                            <button
                                onClick={() => onRemoveIndicator(ind.id)}
                                className="text-white/30 hover:text-red-400 transition-colors ml-0.5"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-[#1a1e2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                    <div className="p-3 border-b border-white/5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-tertiary">
                            Technical Indicators
                        </h3>
                    </div>

                    <div className="p-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                        {INDICATOR_TEMPLATES.map((template) => {
                            const Icon = template.icon;
                            const activeOfType = activeIndicators.filter(i => i.type === template.type);

                            return (
                                <div key={template.type} className="mb-2">
                                    {/* Indicator Header */}
                                    <div className="flex items-center space-x-2 px-3 py-2">
                                        <div className="p-1.5 bg-white/5 rounded-lg">
                                            <Icon className="h-3.5 w-3.5 text-accent" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-black text-white">{template.label}</div>
                                            <div className="text-[9px] text-ink-muted">{template.description}</div>
                                        </div>
                                        <span className="text-[8px] text-ink-muted font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                                            {template.category}
                                        </span>
                                    </div>

                                    {/* Presets */}
                                    <div className="px-3 space-y-1">
                                        {template.presets.map((preset) => {
                                            const isActive = activeOfType.some(i => i.period === preset.period);
                                            return (
                                                <button
                                                    key={preset.label}
                                                    onClick={() => {
                                                        if (isActive) {
                                                            const ind = activeOfType.find(i => i.period === preset.period);
                                                            if (ind) onRemoveIndicator(ind.id);
                                                        } else {
                                                            handleAddPreset(template.type, preset.period, preset.color);
                                                        }
                                                    }}
                                                    className={`
                                                        w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold transition-all
                                                        ${isActive
                                                            ? 'bg-accent/10 text-accent border border-accent/20'
                                                            : 'bg-white/[0.03] text-ink-secondary hover:bg-white/[0.06] hover:text-white border border-transparent'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: preset.color }} />
                                                        <span>{preset.label}</span>
                                                    </div>
                                                    {isActive ? (
                                                        <Minus className="h-3 w-3 text-red-400" />
                                                    ) : (
                                                        <Plus className="h-3 w-3 text-ink-muted" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Custom Period */}
                                    <div className="px-3 mt-2 mb-3">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                min={1}
                                                max={500}
                                                placeholder="Custom period..."
                                                value={customPeriod[template.type] || ''}
                                                onChange={(e) =>
                                                    setCustomPeriod(prev => ({
                                                        ...prev,
                                                        [template.type]: parseInt(e.target.value) || 0,
                                                    }))
                                                }
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white placeholder-ink-muted focus:outline-none focus:border-accent/40 font-mono"
                                            />
                                            <button
                                                onClick={() => handleAddCustom(template.type)}
                                                disabled={!customPeriod[template.type] || customPeriod[template.type]! < 1}
                                                className="px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-accent/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Active Summary */}
                    {activeIndicators.length > 0 && (
                        <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-ink-muted font-bold uppercase tracking-widest">
                                    {activeIndicators.length} active
                                </span>
                                <button
                                    onClick={() => activeIndicators.forEach(i => onRemoveIndicator(i.id))}
                                    className="text-[9px] text-red-400/70 hover:text-red-400 font-bold uppercase tracking-widest transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
