
import { Header } from '../components/layout/Header';
import { Activity, Target, Shield, TrendingUp, Zap, BarChart3, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function StreamMarketEngine() {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Header />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/50 text-blue-400 text-sm font-medium mb-6">
                        <Zap className="h-4 w-4" />
                        <span>{t('Institutional Grade Framework')}</span>
                    </div>
                    <h1 className="text-5xl font-extrabold mb-6 bg-gradient-to-r from-white via-blue-200 to-blue-500 bg-clip-text text-transparent">
                        Stream Market Engine
                    </h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                        {t('Arquitectura avanzada para la decodificación de flujos institucionales. Stream Market Engine permite visualizar las fuerzas subyacentes de la microestructura del mercado, revelando el posicionamiento real de los proveedores de liquidez.')}
                    </p>
                    <div className="mt-8">
                        <Link
                            to="/"
                            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
                        >
                            {t('Go to Dashboard')}
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </Link>
                    </div>
                </div>

                {/* The Core Concept */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-bold">{t('¿Qué es Stream Market Engine?')}</h2>
                        <p className="text-gray-400 leading-relaxed text-lg">
                            {t('Elimina el ruido del análisis convencional. Stream Market Engine procesa dinámicas complejas de opciones y flujos de capital para identificar zonas de alta probabilidad operativa basadas en liquidez y cobertura institucional.')}
                        </p>
                        <ul className="space-y-4">
                            {[
                                { label: 'Gamma Exposure (GEX)', icon: Activity, color: 'text-blue-400' },
                                { label: 'Gamma Flip', icon: Target, color: 'text-purple-400' },
                                { label: 'Institutional Positioning', icon: Shield, color: 'text-green-400' },
                                { label: 'Net Institutional Delta', icon: TrendingUp, color: 'text-orange-400' }
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
                        <div className="relative bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex space-x-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div>
                                <BarChart3 className="h-6 w-6 text-gray-500" />
                            </div>
                            <div className="space-y-6">
                                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                                <div className="flex space-x-4">
                                    <div className="h-20 bg-blue-500/20 border border-blue-500/40 rounded-lg flex-1"></div>
                                    <div className="h-20 bg-purple-500/20 border border-purple-500/40 rounded-lg flex-1"></div>
                                </div>
                                <div className="h-4 bg-gray-700 rounded w-full"></div>
                                <div className="h-32 bg-gray-900 border border-gray-700 rounded-lg flex items-center justify-center">
                                    <Activity className="h-12 w-12 text-blue-500/40 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <FeatureCard
                        icon={<Activity />}
                        title={t('Gamma Exposure (GEX)')}
                        description={t('Mapeo de la exposición neta de los formadores de mercado. Identifica umbrales críticos donde los dealers actúan como estabilizadores o aceleradores de la tendencia.')}
                    />
                    <FeatureCard
                        icon={<Target />}
                        title={t('Gamma Flip Point')}
                        description={t('Define la transición estructural del mercado. Determina el umbral exacto donde el régimen cambia de compresión de volatilidad a expansión direccional.')}
                    />
                    <FeatureCard
                        icon={<Shield />}
                        title={t('Muros de Liquidez')}
                        description={t('Identificación de Call y Put Walls mediante algoritmos de flujo. Zonas de máxima concentración que funcionan como imanes o rechazos institucionales.')}
                    />
                    <FeatureCard
                        icon={<TrendingUp />}
                        title={t('Vector de Delta Neto')}
                        description={t('Análisis del sesgo direccional acumulado. Cuantifica la presión real ejercida por el flujo de contratos para anticipar el sentimiento profesional.')}
                    />
                    <FeatureCard
                        icon={<BarChart3 />}
                        title={t('Structural Net Drift')}
                        description={t('Cuantifica el empuje inercial generado por las coberturas. Permite entender el sesgo de arrastre del mercado basándose en el balance de los libros institucionales.')}
                    />
                    <FeatureCard
                        icon={<Zap />}
                        title={t('Micro-Flow Intelligence')}
                        description={t('Detección de anomalías y barridas de liquidez en tiempo real. Máxima granularidad para anticipar movimientos explosivos mediante la lectura de cinta.')}
                    />
                    <FeatureCard
                        icon={<Target />}
                        title={t('Expected Move Decoding')}
                        description={t('Cálculo del rango estadístico de la sesión mediante el straddle ATM. Define las fronteras de probabilidad donde el precio tiende a ser contenido.')}
                    />
                    <FeatureCard
                        icon={<ChevronRight />}
                        title={t('Algorithmic Signal Engine')}
                        description={t('Generación de estructuras optimizadas (Spreads) validadas por el régimen GEX. Identifica ejecuciones de alta probabilidad fuera del rango esperado.')}
                    />
                </div>

                {/* Call to Action */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/20 rounded-full blur-2xl"></div>

                    <h2 className="text-4xl font-bold mb-6 relative z-10">{t('¿Para quién es Stream Market Engine?')}</h2>
                    <div className="max-w-3xl mx-auto space-y-4 relative z-10 text-blue-100 mb-10">
                        <p>{t('Traders intermedios y avanzados que operan SPX, SPY y QQQ.')}</p>
                        <p>{t('Operadores decididos a profesionalizar su ejecución mediante el dominio de la liquidez y las dinámicas de flujo institucional.')}</p>
                    </div>
                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <Link
                            to="/settings"
                            className="px-8 py-4 bg-white text-blue-800 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg"
                        >
                            {t('Configurar API Schwab')}
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="bg-gray-800/50 border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all group">
            <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-4">{title}</h3>
            <p className="text-gray-400 leading-relaxed">
                {description}
            </p>
        </div>
    );
}
