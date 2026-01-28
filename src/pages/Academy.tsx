
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

                    <div className="overflow-hidden border border-gray-800 rounded-2xl">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800/50 text-gray-300 text-sm uppercase">
                                <tr>
                                    <th className="px-6 py-4">{t('Time Window (ET)')}</th>
                                    <th className="px-6 py-4">{t('Confidence')}</th>
                                    <th className="px-6 py-4">{t('Market Behavior')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 text-gray-400">
                                <tr className="hover:bg-gray-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono text-blue-400">10:00 AM - 1:00 PM</td>
                                    <td className="px-6 py-4 text-red-500 font-bold">LOW</td>
                                    <td className="px-6 py-4">{t('High directional volume. GEX walls can be broken easily.')}</td>
                                </tr>
                                <tr className="hover:bg-gray-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono text-blue-400">1:00 PM - 2:30 PM</td>
                                    <td className="px-6 py-4 text-yellow-500 font-bold">MEDIUM</td>
                                    <td className="px-6 py-4">{t('Magnets begin to emerge. Start watching for convergent walls.')}</td>
                                </tr>
                                <tr className="hover:bg-gray-800/20 transition-colors bg-blue-500/5">
                                    <td className="px-6 py-4 font-mono text-blue-400">2:30 PM - 3:30 PM</td>
                                    <td className="px-6 py-4 text-green-500 font-bold underline">HIGH</td>
                                    <td className="px-6 py-4 font-bold text-gray-200">{t('Golden Window. Institutional positions are locked. Gamma acceleration is at peak.')}</td>
                                </tr>
                                <tr className="hover:bg-gray-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono text-blue-400">3:30 PM - 4:00 PM</td>
                                    <td className="px-6 py-4 text-green-400 font-bold">EXTREME</td>
                                    <td className="px-6 py-4">{t('The Magnet Effect. Price is mechanically sucked into the strike.')}</td>
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
