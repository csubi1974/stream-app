import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Quote, Zap, Shield, Target, Activity, AlertTriangle } from 'lucide-react';
import { useMarketStore } from '../../stores/marketStore';

export function MarketBriefing() {
    const { t } = useTranslation();
    const { gexMetrics, selectedSymbol } = useMarketStore();

    const briefing = useMemo(() => {
        if (!gexMetrics) return null;

        const {
            regime,
            totalGEX,
            currentPrice,
            gammaFlip,
            netInstitutionalDelta,
            netDrift,
            netVanna,
            netCharm,
            callWall,
            putWall,
            pinningTarget,
            pinningConfidence
        } = gexMetrics;

        const paragraphs = [];

        // 1. Estado del Régimen y Volatilidad
        if (regime === 'stable') {
            paragraphs.push({
                icon: <Activity className="h-4 w-4 text-green-400" />,
                title: "Régimen de Estabilidad",
                text: `El mercado opera actualmente bajo un régimen de Gamma Positiva (GEX Total: ${totalGEX > 1e6 ? (totalGEX / 1e6).toFixed(2) + 'M' : totalGEX.toFixed(0)}). En este entorno, los Market Makers actúan como amortiguadores, comprando debilidad y vendiendo fortaleza, lo que sugiere una baja volatilidad y una tendencia a la reversión a la media.`
            });
        } else if (regime === 'volatile') {
            paragraphs.push({
                icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
                title: "Régimen de Volatilidad",
                text: `Alerta: El mercado ha entrado en régimen de Gamma Negativa. Con un GEX Total de ${totalGEX > 1e6 ? (totalGEX / 1e6).toFixed(2) + 'M' : totalGEX.toFixed(0)}, los proveedores de liquidez deben cubrirse a favor del movimiento, lo que acelera los desplazamientos del precio y aumenta drásticamente la probabilidad de movimientos explosivos.`
            });
        }

        // 2. Posicionamiento Institucional y Sesgo
        const bias = netInstitutionalDelta > 0 ? "ALCISTA" : "BAJISTA";
        const biasColor = netInstitutionalDelta > 0 ? "text-green-400" : "text-red-400";
        paragraphs.push({
            icon: <Zap className="h-4 w-4 text-yellow-400" />,
            title: "Sesgo y Flujo Institucional",
            text: `Detectamos un posicionamiento institucional neto ${bias} (${(netInstitutionalDelta / 1000).toFixed(1)}k delta). La deriva estructural (Net Drift) es de ${netDrift.toFixed(2)}, lo que indica que el flujo profesional está ejerciendo una presión ${netDrift > 0 ? 'ascendente' : 'descendente'} constante sobre el subyacente.`
        });

        // 3. Fuerzas Mecánicas (Vanna y Charm)
        if (Math.abs(netVanna) > 1000 || Math.abs(netCharm) > 1000) {
            let mechanicText = "";
            if (netVanna > 0 && netCharm > 0) {
                mechanicText = "La alineación de Vanna y Charm positivos genera un 'viento a favor' mecánico. Si la volatilidad cae o conforme avanza la sesión, los Dealers se verán obligados a comprar acciones para rebalancear sus libros.";
            } else if (netVanna < 0 && netCharm < 0) {
                mechanicText = "La combinación de Vanna y Charm negativos sugiere una presión de venta mecánica. Los ajustes de cobertura institucional podrían actuar como un lastre para el precio durante la jornada.";
            } else {
                mechanicText = "Las fuerzas de Vanna y Charm están contrapuestas en este momento, lo que sugiere un entorno de 'ruido' donde las coberturas mecánicas no tienen una dirección clara.";
            }
            paragraphs.push({
                icon: <Shield className="h-4 w-4 text-blue-400" />,
                title: "Vectores de Cobertura",
                text: mechanicText
            });
        }

        // 4. Niveles Críticos y Magnetismo
        const distToFlip = ((currentPrice - gammaFlip) / currentPrice) * 100;
        const distToCallWall = Math.abs(currentPrice - callWall) / currentPrice;
        const distToPutWall = Math.abs(currentPrice - putWall) / currentPrice;

        let levelsText = `El precio actual de $${currentPrice.toFixed(2)} se encuentra ${currentPrice > gammaFlip ? 'por encima' : 'por debajo'} del Gamma Flip ($${gammaFlip.toFixed(2)}). `;

        if (distToCallWall < 0.01) {
            levelsText += `Estamos operando muy cerca del Call Wall ($${callWall}), nivel que históricamente presenta una resistencia institucional extrema. `;
        } else if (distToPutWall < 0.01) {
            levelsText += `El precio está testeando el Put Wall ($${putWall}), el soporte de liquidez más fuerte del día. `;
        } else {
            levelsText += `Los muros de liquidez se mantienen estables en $${putWall} (Soporte) y $${callWall} (Resistencia). `;
        }

        if (pinningTarget && pinningConfidence && pinningConfidence > 60) {
            levelsText += `Existe una probabilidad del ${pinningConfidence.toFixed(0)}% de anclaje (Pinning) hacia el strike de $${pinningTarget} al cierre.`;
        }

        paragraphs.push({
            icon: <Target className="h-4 w-4 text-purple-400" />,
            title: "Gravedad y Niveles",
            text: levelsText
        });

        return paragraphs;
    }, [gexMetrics]);

    if (!briefing) return null;

    const displaySymbol = selectedSymbol || 'SPX';

    return (
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-gray-800/50 gap-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Quote className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Daily Intelligence Briefing</h2>
                        <div className="flex items-center space-x-2">
                            <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase tracking-widest animate-pulse">
                                En Tiempo Real
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selected Asset Display - Highlighted */}
                <div className="flex items-center bg-gray-950 px-4 py-2 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <div className="flex flex-col items-end mr-3">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Analizando Activo</span>
                        <span className="text-xs text-blue-400 font-mono font-bold">Structural Micro-Data</span>
                    </div>
                    <div className="text-3xl font-black text-white px-3 border-l border-gray-800">
                        {displaySymbol}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {briefing.map((item, index) => (
                    <div key={index} className="relative pl-8 group">
                        <div className="absolute left-0 top-1">
                            {item.icon}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-400/80 transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-gray-300 leading-relaxed font-medium">
                                {item.text}
                            </p>
                        </div>
                        {index < briefing.length - 1 && (
                            <div className="absolute left-[7px] top-7 bottom-[-20px] w-px bg-gradient-to-b from-gray-800 to-transparent" />
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-10 pt-6 border-t border-gray-800/50">
                <p className="text-[10px] text-gray-500 italic leading-tight">
                    * Este resumen se genera dinámicamente analizando la microestructura del mercado, el posicionamiento de los proveedores de liquidez y los vectores de cobertura de segundo orden (Vanna/Charm). No constituye asesoría financiera.
                </p>
            </div>
        </div>
    );
}
