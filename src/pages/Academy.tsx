
import { Header } from '../components/layout/Header';
import { BookOpen, Target, Activity, Zap, Clock, Shield, ChevronRight, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function Academy() {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Header />

            <main className="max-w-5xl mx-auto px-4 py-12">
                <div className="flex items-center space-x-3 mb-8">
                    <div className="p-3 bg-blue-600/20 border border-blue-500/50 rounded-xl">
                        <BookOpen className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black">{t('Institutional Trading Guide')}</h1>
                        <p className="text-gray-500 font-medium">{t('Learn the mechanics behind Market Maker gamma hedging')}</p>
                    </div>
                </div>

                {/* Section: The GEX Logic */}
                <section className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 mb-8">
                    <div className="flex items-center space-x-2 text-blue-400 font-bold mb-4 uppercase tracking-widest text-sm">
                        <Activity className="h-4 w-4" />
                        <span>Gamma Exposure (GEX)</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-6">{t('Understanding Market Mechanics')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="p-5 bg-green-900/10 border border-green-500/30 rounded-2xl">
                                <h3 className="text-green-400 font-bold text-xl mb-2">Positive GEX (Stabilizer)</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    {t('When GEX is positive, Market Makers trade "against" the move. They buy dips and sell rallies to keep their delta neutral. This compresses volatility and leads to mean reversion.')}
                                </p>
                            </div>
                            <div className="p-5 bg-red-900/10 border border-red-500/30 rounded-2xl">
                                <h3 className="text-red-400 font-bold text-xl mb-2">Negative GEX (Accelerator)</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    {t('When GEX is negative, Market Makers trade "with" the move. They must sell as the market falls and buy as it rises. This creates aggressive momentum and explosive volatility.')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-center p-8 bg-gray-800/20 border border-gray-800 rounded-2xl italic text-gray-500 text-center">
                            {t('GEX is the primary force behind price attraction and repulsion in modern electronic markets.')}
                        </div>
                    </div>
                </section>

                {/* Section: Pinning Strategy */}
                <section className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 mb-8">
                    <div className="flex items-center space-x-2 text-yellow-400 font-bold mb-4 uppercase tracking-widest text-sm">
                        <Target className="h-4 w-4" />
                        <span>Market Pinning Strategy</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-6">{t('How to Anticipate the Close')}</h2>
                    <p className="text-gray-400 mb-8 max-w-3xl">
                        {t('Market Pinning occurs when the gravity of a specific strike (usually a convergent Call/Put Wall) "traps" the price during the final hours of trading.')}
                    </p>

                    <div className="space-y-6 mb-8">
                        <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-2xl">
                            <h3 className="text-xl font-bold mb-3 text-blue-300">1. {t('The Critical Window: Last 90 Minutes')}</h3>
                            <p className="text-gray-400 leading-relaxed mb-4">
                                {t('Pinning does not happen at once; it has an optimal time window where data shifts from "noisy" to "predictive".')}
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-start space-x-3">
                                    <span className="px-2 py-0.5 bg-red-900/40 text-red-400 rounded text-xs font-mono font-bold mt-1">10:00 AM - 1:00 PM</span>
                                    <span className="text-gray-400 text-sm">
                                        <strong className="text-gray-300">{t('Unreliable.')}</strong> {t('Market still has directional volume. GEX walls exist but can be broken by news or order flow.')}
                                    </span>
                                </li>
                                <li className="flex items-start space-x-3">
                                    <span className="px-2 py-0.5 bg-yellow-900/40 text-yellow-400 rounded text-xs font-mono font-bold mt-1">1:00 PM - 2:30 PM</span>
                                    <span className="text-gray-400 text-sm">
                                        <strong className="text-gray-300">{t('Magnets Emerge.')}</strong> {t('Start watching the Pinning Target. If consistent, real confidence is higher than displayed.')}
                                    </span>
                                </li>
                                <li className="flex items-start space-x-3">
                                    <span className="px-2 py-0.5 bg-green-900/40 text-green-400 rounded text-xs font-mono font-bold mt-1">2:30 PM - 3:30 PM</span>
                                    <span className="text-gray-400 text-sm">
                                        <strong className="text-gray-300">{t('Golden Window.')}</strong> {t('Institutional decisions are made. Gamma grows exponentially. If confidence >70%, high probability.')}
                                    </span>
                                </li>
                            </ul>
                        </div>

                        <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-2xl">
                            <h3 className="text-xl font-bold mb-3 text-purple-300">2. {t('The Final Magnet Effect (3:30 PM - Close)')}</h3>
                            <p className="text-gray-400 leading-relaxed">
                                {t('In the last 30 minutes, sharp moves often occur as the market is "sucked" into the Pinning Target.')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4 p-5 bg-gradient-to-r from-blue-900/20 to-transparent border-l-4 border-blue-500 rounded-r-xl mb-8">
                        <Info className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="text-blue-400 font-bold text-sm uppercase tracking-wider mb-1">{t('Pro Tip')}</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                {t('If at 3:45 PM price is slightly off the Pinning Target but HUD shows SOLID confidence, that is an opportunity for a mean reversion trade toward the wall strike.')}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden border border-gray-800 rounded-2xl">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800/50 text-gray-300 text-sm uppercase">
                                <tr>
                                    <th className="px-6 py-4">{t('Time (ET)')}</th>
                                    <th className="px-6 py-4">{t('What to Expect')}</th>
                                    <th className="px-6 py-4">{t('Action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 text-gray-400">
                                <tr className="hover:bg-gray-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono text-blue-400">{t('Open')}</td>
                                    <td className="px-6 py-4">{t('Noise and volatility.')}</td>
                                    <td className="px-6 py-4 text-red-400 font-bold">{t('Ignore Pinning Target.')}</td>
                                </tr>
                                <tr className="hover:bg-gray-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono text-blue-400">1:30 PM</td>
                                    <td className="px-6 py-4">{t('HUD detects convergence.')}</td>
                                    <td className="px-6 py-4 text-yellow-500 font-bold">{t('Identify Target.')}</td>
                                </tr>
                                <tr className="hover:bg-gray-800/20 transition-colors bg-blue-500/5">
                                    <td className="px-6 py-4 font-mono text-blue-400">2:30 PM</td>
                                    <td className="px-6 py-4 font-bold text-gray-200">{t('Walls become "SOLID".')}</td>
                                    <td className="px-6 py-4 text-green-500 font-bold">{t('Validate Price Respect.')}</td>
                                </tr>
                                <tr className="hover:bg-gray-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono text-blue-400">3:30 PM</td>
                                    <td className="px-6 py-4">{t('Max Gamma Acceleration.')}</td>
                                    <td className="px-6 py-4 text-green-400 font-bold">{t('Execute if Valid.')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Second Order Greeks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8">
                        <div className="flex items-center space-x-2 text-purple-400 font-bold mb-4 uppercase tracking-widest text-sm">
                            <Zap className="h-4 w-4" />
                            <span>Vanna</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-4">{t('Volatility Sensitivity')}</h3>
                        <p className="text-gray-400 leading-relaxed">
                            {t('Vanna measures how GEX changes with Volatility (IV). If Net Vanna is positive, as IV drops, Dealers are forced to buy stocks to remain neutral (The Vanna Rally).')}
                        </p>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8">
                        <div className="flex items-center space-x-2 text-pink-400 font-bold mb-4 uppercase tracking-widest text-sm">
                            <Clock className="h-4 w-4" />
                            <span>Charm</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-4">{t('Time Decay (Delta)')}</h3>
                        <p className="text-gray-400 leading-relaxed">
                            {t('Charm measures how Dealer delta changes as time passes. For 0DTE, this effect is massive in the final hours, forcing buying/selling purely based on the clock.')}
                        </p>
                    </div>
                </div>

                {/* Call to action */}
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
