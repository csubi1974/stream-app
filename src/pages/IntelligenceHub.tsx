import { Header } from '../components/layout/Header';
import { MarketBriefing } from '../components/dashboard/MarketBriefing';
import { BookOpen, Target, Activity, Zap, Clock, Shield, ChevronRight, Info, TrendingUp, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function IntelligenceHub() {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Header />

            <main className="max-w-6xl mx-auto px-4 py-12">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/50 text-blue-400 text-sm font-medium mb-6">
                        <Zap className="h-4 w-4" />
                        <span>{t('Institutional Grade Framework')}</span>
                    </div>
                    <h1 className="text-5xl font-extrabold mb-6 bg-gradient-to-r from-white via-blue-200 to-blue-500 bg-clip-text text-transparent">
                        {t('Market Intelligence Hub')}
                    </h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                        {t('Real-time synthesis of market microstructure and institutional flows.')}
                    </p>
                </div>

                {/* Section 1: Dynamic Market Briefing (PURE TEXT - AI Generated feel) */}
                <section className="mb-20">
                    <div className="flex items-center space-x-2 text-blue-400 font-bold mb-6 uppercase tracking-widest text-sm">
                        <Activity className="h-4 w-4" />
                        <span>{t('Daily Market Analysis')}</span>
                    </div>
                    <MarketBriefing />
                </section>

                {/* Section 2: Core Engine Features (Combined from Market Engine) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-bold">{t('¿Qué es Stream Market Engine?')}</h2>
                        <p className="text-gray-400 leading-relaxed text-lg">
                            {t('Elimina el ruido del análisis retail convencional. Nuestra infraestructura procesa miles de puntos de datos de cobertura para identificar los nodos de liquidez donde la intervención institucional es mecánicamente inevitable.')}
                        </p>
                        <ul className="space-y-4">
                            {[
                                { label: 'Gamma Exposure (GEX): El mapa de liquidez institucional', icon: Activity, color: 'text-blue-400' },
                                { label: 'Net Vanna & Charm: Sensores de volatilidad y tiempo', icon: Zap, color: 'text-yellow-400' },
                                { label: 'Quality Scoring: Filtrado algorítmico de riesgo', icon: Shield, color: 'text-green-400' },
                                { label: 'Institutional Delta: Rastreo del sesgo de mercado', icon: TrendingUp, color: 'text-orange-400' }
                            ].map((item, i) => (
                                <li key={i} className="flex items-center space-x-3 text-gray-300 font-medium">
                                    <item.icon className={`h-5 w-5 ${item.color}`} />
                                    <span>{t(item.label)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex space-x-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div>
                                <BarChart3 className="h-6 w-6 text-gray-500" />
                            </div>
                            <div className="space-y-6">
                                <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                                <div className="h-4 bg-gray-800 rounded w-1/2"></div>
                                <div className="flex space-x-4">
                                    <div className="h-20 bg-blue-500/10 border border-blue-500/20 rounded-lg flex-1"></div>
                                    <div className="h-20 bg-purple-500/10 border border-purple-500/20 rounded-lg flex-1"></div>
                                </div>
                                <div className="h-4 bg-gray-800 rounded w-full"></div>
                                <div className="h-32 bg-gray-950 border border-gray-800 rounded-lg flex items-center justify-center">
                                    <Activity className="h-12 w-12 text-blue-500/20 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: GEX Logic (Academy) */}
                <section className="bg-gray-900/30 border border-gray-800 rounded-3xl p-8 mb-12">
                    <div className="flex items-center space-x-2 text-blue-400 font-bold mb-4 uppercase tracking-widest text-sm">
                        <BookOpen className="h-4 w-4" />
                        <span>{t('GEX Theory')}</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-6">{t('Understanding Market Mechanics')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="p-5 bg-green-900/10 border border-green-500/30 rounded-2xl">
                                <h3 className="text-green-400 font-bold text-xl mb-2">Positive GEX (Stabilizer)</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    {t('When GEX is positive, Market Makers trade "against" the move. They buy dips and sell rallies to keep their delta neutral. This compresses volatility and leads to mean reversion.')}
                                </p>
                            </div>
                            <div className="p-5 bg-red-900/10 border border-red-500/30 rounded-2xl">
                                <h3 className="text-red-400 font-bold text-xl mb-2">Negative GEX (Accelerator)</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    {t('When GEX is negative, Market Makers trade "with" the move. They must sell as the market falls and buy as it rises. This creates aggressive momentum and explosive volatility.')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-center p-8 bg-gray-900/50 border border-gray-800 rounded-2xl italic text-gray-400 text-center text-sm">
                            "{t('GEX is the primary force behind price attraction and repulsion in modern electronic markets.')}"
                        </div>
                    </div>
                </section>

                {/* Section 4: Pinning Strategy */}
                <section className="bg-gray-900/30 border border-gray-800 rounded-3xl p-8 mb-12">
                    <div className="flex items-center space-x-2 text-yellow-400 font-bold mb-4 uppercase tracking-widest text-sm">
                        <Target className="h-4 w-4" />
                        <span>Market Pinning Strategy</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-6">{t('How to Anticipate the Close')}</h2>
                    <p className="text-gray-400 mb-8 max-w-3xl">
                        {t('Market Pinning occurs when the gravity of a specific strike (usually a convergent Call/Put Wall) "traps" the price during the final hours of trading.')}
                    </p>

                    <div className="space-y-6 mb-8">
                        <div className="p-5 bg-gray-900/40 border border-gray-800 rounded-2xl">
                            <h3 className="text-xl font-bold mb-3 text-blue-300">1. {t('The Critical Window: Last 90 Minutes')}</h3>
                            <p className="text-gray-400 leading-relaxed mb-4 text-sm">
                                {t('Pinning does not happen at once; it has an optimal time window where data shifts from "noisy" to "predictive".')}
                            </p>
                            <ul className="space-y-3">
                                {[
                                    { time: '10:00 AM - 1:00 PM', status: 'Unreliable.', desc: 'Market still has directional volume. GEX walls exist but can be broken by news or order flow.', color: 'bg-red-900/40 text-red-400' },
                                    { time: '1:00 PM - 2:30 PM', status: 'Magnets Emerge.', desc: 'Start watching the Pinning Target. If consistent, real confidence is higher than displayed.', color: 'bg-yellow-900/40 text-yellow-400' },
                                    { time: '2:30 PM - 3:30 PM', status: 'Golden Window.', desc: 'Institutional decisions are made. Gamma grows exponentially. If confidence >70%, high probability.', color: 'bg-green-900/40 text-green-400' }
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start space-x-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold mt-1 shadow-sm ${item.color}`}>{item.time}</span>
                                        <span className="text-gray-400 text-sm">
                                            <strong className="text-gray-200">{t(item.status)}</strong> {t(item.desc)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4 p-5 bg-gradient-to-r from-blue-900/20 to-transparent border-l-4 border-blue-500 rounded-r-xl">
                        <Info className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="text-blue-400 font-bold text-sm uppercase tracking-wider mb-1">{t('Pro Tip')}</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                {t('If at 3:45 PM price is slightly off the Pinning Target but HUD shows SOLID confidence, that is an opportunity for a mean reversion trade toward the wall strike.')}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Greeks Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-8">
                        <div className="flex items-center space-x-2 text-purple-400 font-bold mb-4 uppercase tracking-widest text-sm">
                            <Zap className="h-4 w-4" />
                            <span>Vanna</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-4">{t('Volatility Sensitivity')}</h3>
                        <p className="text-gray-400 leading-relaxed text-sm">
                            {t('Vanna measures how GEX changes with Volatility (IV). If Net Vanna is positive, as IV drops, Dealers are forced to buy stocks to remain neutral (The Vanna Rally).')}
                        </p>
                    </div>
                    <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-8">
                        <div className="flex items-center space-x-2 text-pink-400 font-bold mb-4 uppercase tracking-widest text-sm">
                            <Clock className="h-4 w-4" />
                            <span>Charm</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-4">{t('Time Decay (Delta)')}</h3>
                        <p className="text-gray-400 leading-relaxed text-sm">
                            {t('Charm measures how Dealer delta changes as time passes. For 0DTE, this effect is massive in the final hours, forcing buying/selling purely based on the clock.')}
                        </p>
                    </div>
                </div>

                {/* CTA */}
                <div className="text-center p-12 bg-gradient-to-b from-blue-600/10 to-transparent border border-blue-500/20 rounded-3xl">
                    <Shield className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-4">{t('Ready to trade with an edge?')}</h2>
                    <p className="text-gray-400 mb-6">{t('Apply these concepts using the Real-Time GEX HUD on the dashboard.')}</p>
                    <Link to="/" className="inline-flex items-center space-x-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all">
                        <span>{t('Back to Dashboard')}</span>
                        <ChevronRight className="h-5 w-5" />
                    </Link>
                </div>
            </main>
        </div>
    );
}
