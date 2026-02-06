import { SchwabService } from './schwabService.js';

export interface GEXMetrics {
    totalGEX: number;
    gammaFlip: number;
    netInstitutionalDelta: number;
    netDrift: number;
    callWall: number;
    putWall: number;
    currentPrice: number;
    regime: 'stable' | 'volatile' | 'neutral';
    expectedMove?: number; // Expected daily move based on ATM straddle
    netVanna: number;      // Net Vanna exposure
    netCharm: number;      // Net Charm exposure (Delta decay)
    callWallStrength?: 'solid' | 'weak' | 'uncertain';
    putWallStrength?: 'solid' | 'weak' | 'uncertain';
    callWallLiquidity?: number; // Total contracts sitting at the wall in Level 2
    putWallLiquidity?: number;  // Total contracts sitting at the wall in Level 2
    pinningTarget?: number;
    pinningConfidence?: number;
    pinningRationale?: string;
    gammaProfile: Array<{ price: number, netGex: number }>;
}

export class GEXService {
    private schwabService: SchwabService;

    constructor(schwabService: SchwabService) {
        this.schwabService = schwabService;
    }

    /**
     * Calcula todas las métricas GEX avanzadas para un símbolo
     */
    async calculateGEXMetrics(symbol: string = 'SPX'): Promise<GEXMetrics> {
        try {
            let searchSymbol = symbol.toUpperCase();

            // Si es SPX, intentamos con el prefijo $ que es estándar para índices en Schwab
            let chain = null;
            if (searchSymbol === 'SPX') {
                console.log('📡 GEX: Trying $SPX index symbol first...');
                chain = await this.schwabService.getOptionsChain('$SPX');
                if (chain && (chain.callExpDateMap || chain.putExpDateMap)) {
                    searchSymbol = '$SPX';
                }
            }

            // Si no funcionó $SPX, intentamos con el símbolo original
            if (!chain || (!chain.callExpDateMap && !chain.putExpDateMap)) {
                chain = await this.schwabService.getOptionsChain(searchSymbol);
            }

            // Fallback for SPX to SPXW
            if ((!chain || (!chain.callExpDateMap && !chain.putExpDateMap)) && searchSymbol.includes('SPX')) {
                console.log('⚠️ GEX: SPX Chain unavailable, trying SPXW...');
                chain = await this.schwabService.getOptionsChain('SPXW');
                if (chain && (chain.callExpDateMap || chain.putExpDateMap)) searchSymbol = 'SPXW';
            }

            if (!chain || (!chain.callExpDateMap && !chain.calls)) {
                console.warn(`⚠️ No options chain data available for GEX calculation (${symbol}) after multiple attempts`);
                return this.getDefaultMetrics();
            }

            // Flatten options data
            const allOptions: any[] = [];
            allOptions.push(...this.flattenOptionsMap(chain.callExpDateMap || chain.calls));
            allOptions.push(...this.flattenOptionsMap(chain.putExpDateMap || chain.puts));

            return this.processGEXOptions(chain, allOptions);
        } catch (error) {
            console.error('❌ Failed to calculate GEX metrics:', error);
            return this.getDefaultMetrics();
        }
    }

    /**
     * Procesa una lista de opciones para calcular métricas GEX
     */
    private async processGEXOptions(chain: any, allOptions: any[]): Promise<GEXMetrics> {
        try {
            // Robust price detection
            const currentPrice = chain.underlying?.last ||
                chain.underlying?.lastPrice ||
                chain.underlyingPrice || 0;

            // Calcular métricas por strike
            const strikeMetrics = new Map<number, {
                callGEX: number;
                putGEX: number;
                callDelta: number;
                putDelta: number;
                callOI: number;
                putOI: number;
                netGEX: number;
                netVanna: number;
                netCharm: number;
            }>();

            let maxCallGEX = 0;
            let maxPutGEX = 0;
            let callWallStrike = 0;
            let putWallStrike = 0;

            // Procesar cada opción
            for (const opt of allOptions) {
                const strike = parseFloat(opt.strikePrice || opt.strike || 0);
                if (strike === 0) continue;

                const oi = opt.openInterest || 0;
                const gammaFromAPI = opt.gamma || 0;
                const volatility = (opt.volatility || 20) / 100;
                const isCall = opt.putCall === 'CALL';

                // Calcular T real para re-calculo (mismo que en profile)
                const today = new Date();
                const expDate = new Date();
                expDate.setHours(16, 0, 0, 0);
                let tReal = (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 365);
                if (tReal <= 0) tReal = 1 / 365;

                // Si es una opción con vencimiento hoy (o muy cercano), recalcular gamma
                let gamma = gammaFromAPI;
                const isToday = opt.expirationDate?.startsWith(new Date().toLocaleDateString('en-CA'));
                if (isToday && tReal < 1 / 365) {
                    gamma = this.calculateBSGamma(currentPrice, strike, volatility, tReal);
                }

                const delta = opt.delta || 0;

                if (!strikeMetrics.has(strike)) {
                    strikeMetrics.set(strike, {
                        callGEX: 0,
                        putGEX: 0,
                        callDelta: 0,
                        putDelta: 0,
                        callOI: 0,
                        putOI: 0,
                        netGEX: 0,
                        netVanna: 0,
                        netCharm: 0
                    });
                }

                const metrics = strikeMetrics.get(strike)!;

                // Calcular GEX = Gamma * OI * 100 * Spot Price
                // Factor 100 porque cada contrato representa 100 acciones
                const gexContribution = gamma * oi * 100 * currentPrice;

                // Vanna approximation if not provided: Vanna ≈ Vega / IV (simplified for Net exposure)
                // Institutional Vanna is typically dDelta/dVol
                const vega = opt.vega || 0;
                const vannaContribution = vega * oi * 100; // Simplified Vanna exposure


                if (isCall) {
                    metrics.callGEX += gexContribution;
                    metrics.callDelta += delta * oi * 100;
                    metrics.callOI += oi;
                    metrics.netVanna += vannaContribution; // Calls have positive Vanna


                    // Actualizar Call Wall (Strike con mayor Call GEX positivo)
                    if (metrics.callGEX > maxCallGEX) {
                        maxCallGEX = metrics.callGEX;
                        callWallStrike = strike;
                    }
                } else {
                    // Put GEX es negativo para dealers (ellos están short puts)
                    metrics.putGEX -= gexContribution;
                    metrics.putDelta += delta * oi * 100;
                    metrics.putOI += oi;
                    metrics.netVanna -= vannaContribution; // Puts have negative Vanna for dealers (short puts)


                    // Actualizar Put Wall (Strike con mayor Put GEX negativo - buscamos el valor más bajo)
                    if (metrics.putGEX < maxPutGEX) {
                        maxPutGEX = metrics.putGEX;
                        putWallStrike = strike;
                    }
                }

                metrics.netGEX = metrics.callGEX + metrics.putGEX;

                // Charm Calculation (Delta Decay)
                // For 0DTE, Delta of OTM options decays to 0. 
                // Rate: Delta / TimeRemaining
                // We use minutes to expiration for a more granular 0DTE view
                const now = new Date();
                const closeTime = new Date();
                closeTime.setHours(16, 0, 0, 0); // 4 PM ET
                const minutesLeft = Math.max(1, (closeTime.getTime() - now.getTime()) / (1000 * 60));

                // Charm = Total Delta that will decay / minutes remaining
                // Inverted because we want Dealer position (Dealer is short the option)
                // Short Call Delta: -0.15 -> 0 (Needs to buy)
                // Short Put Delta: +0.15 -> 0 (Needs to sell)
                metrics.netCharm = -(metrics.callDelta + metrics.putDelta) / minutesLeft;
            }

            // 1. Total Metrics
            let totalGEX = 0;
            let netVanna = 0;
            let netCharm = 0;
            strikeMetrics.forEach(m => {
                totalGEX += m.netGEX;
                netVanna += m.netVanna;
                netCharm += m.netCharm;
            });

            // 2. gammaProfile y Gamma Flip consistente
            const gammaProfile = this.calculateGammaProfile(allOptions, currentPrice);

            // Buscar el punto donde la curva cruza por cero (Gamma Flip)
            let gammaFlip = currentPrice;
            if (gammaProfile.length > 0) {
                for (let i = 0; i < gammaProfile.length - 1; i++) {
                    const p1 = gammaProfile[i];
                    const p2 = gammaProfile[i + 1];

                    // Si hay un cambio de signo entre estos dos puntos
                    if (p1.netGex * p2.netGex <= 0) {
                        // Interpolación lineal simple para encontrar el cero exacto
                        const weight = Math.abs(p1.netGex) / (Math.abs(p1.netGex) + Math.abs(p2.netGex));
                        gammaFlip = p1.price + weight * (p2.price - p1.price);
                        break;
                    }
                }
            }

            // 3. Net Institutional Delta
            // Dealers tienen posición opuesta a clientes
            // Si clientes compran calls (positive delta), dealers tienen negative delta
            let netCallDelta = 0;
            let netPutDelta = 0;

            strikeMetrics.forEach(m => {
                netCallDelta += m.callDelta;
                netPutDelta += m.putDelta;
            });

            // Invertir porque queremos la posición DEALER (institucional)
            const netInstitutionalDelta = -(netCallDelta + netPutDelta);

            // 4. Net Drift
            // Presión estructural basada en delta institucional
            // Normalizar por el precio actual para obtener un valor interpretable
            const netDrift = (netInstitutionalDelta / currentPrice) * 100;

            // 5. Determinar régimen de volatilidad
            let regime: 'stable' | 'volatile' | 'neutral' = 'neutral';

            if (totalGEX > 0) {
                regime = 'stable'; // Gamma positiva = dealers amortiguan movimientos
            } else if (totalGEX < 0) {
                regime = 'volatile'; // Gamma negativa = dealers amplifican movimientos
            }

            // Ajustar si estamos cerca del gamma flip
            const distanceToFlip = Math.abs(currentPrice - gammaFlip) / currentPrice;
            if (distanceToFlip < 0.002) { // Menos de 0.2% (Más preciso para activos de alto precio)
                regime = 'neutral'; // Cerca del flip = mayor incertidumbre
            }

            // 6. Calculate Expected Move (ATM Straddle)
            const expectedMove = this.calculateExpectedMove(allOptions, currentPrice);

            // 7. LEVEL 2 WALL VALIDATION (NEW)
            let callWallStrength: 'solid' | 'weak' | 'uncertain' = 'uncertain';
            let putWallStrength: 'solid' | 'weak' | 'uncertain' = 'uncertain';
            let callWallLiquidity = 0;
            let putWallLiquidity = 0;

            try {
                // Find option symbols for the walls with more robust matching
                const callWallOpt = allOptions.find(o =>
                    o.putCall === 'CALL' &&
                    Math.abs(Number(o.strikePrice || o.strike) - callWallStrike) < 0.5
                );
                const putWallOpt = allOptions.find(o =>
                    o.putCall === 'PUT' &&
                    Math.abs(Number(o.strikePrice || o.strike) - putWallStrike) < 0.5
                );

                console.log('🔍 GEX Wall Debug:', {
                    callWallStrike,
                    putWallStrike,
                    callFound: !!callWallOpt,
                    putFound: !!putWallOpt
                });

                if (callWallOpt) {
                    // Use Open Interest as the true measure of wall strength
                    // OI represents total open contracts, which is what creates the GEX wall
                    callWallLiquidity = callWallOpt.openInterest || 0;

                    console.log('📊 Call Wall:', {
                        strike: callWallOpt.strikePrice || callWallOpt.strike,
                        openInterest: callWallOpt.openInterest,
                        liquidity: callWallLiquidity
                    });

                    // Thresholds adjusted for OI (typically much higher than bid/ask size)
                    if (callWallLiquidity > 5000) callWallStrength = 'solid';
                    else if (callWallLiquidity > 0 && callWallLiquidity < 1000) callWallStrength = 'weak';
                    else if (callWallLiquidity > 0) callWallStrength = 'solid';
                }

                if (putWallOpt) {
                    // Use Open Interest for Put Wall as well
                    putWallLiquidity = putWallOpt.openInterest || 0;

                    console.log('📊 Put Wall:', {
                        strike: putWallOpt.strikePrice || putWallOpt.strike,
                        openInterest: putWallOpt.openInterest,
                        liquidity: putWallLiquidity
                    });

                    if (putWallLiquidity > 5000) putWallStrength = 'solid';
                    else if (putWallLiquidity > 0 && putWallLiquidity < 1000) putWallStrength = 'weak';
                    else if (putWallLiquidity > 0) putWallStrength = 'solid';
                }

                // If market is closed, don't flag as "weak" just because liquidity is 0
                const now = new Date();
                const isAfterHours = (() => {
                    try {
                        const nyTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
                        const nyTime = new Date(nyTimeStr);
                        return nyTime.getHours() >= 16 || nyTime.getHours() < 9 || (nyTime.getHours() === 9 && nyTime.getMinutes() < 30);
                    } catch (e) {
                        return now.getUTCHours() >= 21 || now.getUTCHours() < 14;
                    }
                })();

                if (isAfterHours && callWallLiquidity === 0) callWallStrength = 'uncertain';
                if (isAfterHours && putWallLiquidity === 0) putWallStrength = 'uncertain';

            } catch (err) {
                console.warn('⚠️ GEX: Wall validation error:', err);
            }

            // 8. MARKET PINNING PREDICTION (NEW)
            let pinningTarget = callWallStrike;
            let pinningConfidence = 0;
            let pinningRationale = '';

            if (callWallStrike === putWallStrike) {
                pinningTarget = callWallStrike;
                pinningConfidence = (callWallStrength === 'solid' && putWallStrength === 'solid') ? 85 : 65;
                pinningRationale = 'High Concentration: Dealers Pinning Target (Convergent Walls)';
            } else {
                // Find strike with highest net absolute GEX near current price
                const activeRange = strikeMetrics.values();
                let maxImpact = 0;
                for (const m of activeRange) {
                    if (Math.abs(m.netGEX) > maxImpact) {
                        maxImpact = Math.abs(m.netGEX);
                        // Simplified picking
                    }
                }
                pinningTarget = Math.abs(currentPrice - callWallStrike) < Math.abs(currentPrice - putWallStrike) ? callWallStrike : putWallStrike;
                pinningConfidence = 45;
                pinningRationale = 'Gamma Magnet: Nearest Major Liquidity Wall';
            }

            // Adjustment for negative gamma
            if (regime === 'volatile') {
                pinningConfidence -= 20;
                pinningRationale = 'Low Confidence: Negative Gamma Regime (No Anchor)';
            }

            return {
                totalGEX,
                gammaFlip,
                netInstitutionalDelta,
                netDrift,
                callWall: callWallStrike,
                putWall: putWallStrike,
                callWallStrength,
                putWallStrength,
                callWallLiquidity,
                putWallLiquidity,
                pinningTarget,
                pinningConfidence,
                pinningRationale,
                currentPrice,
                regime,
                expectedMove,
                netVanna,
                netCharm,
                gammaProfile
            };
        } catch (error) {
            console.error('❌ Error in processGEXOptions:', error);
            return this.getDefaultMetrics();
        }
    }

    /**
     * Flatten options map structure (for both real API and mock data)
     */
    private flattenOptionsMap(optionsMap: any): any[] {
        if (!optionsMap) return [];
        if (Array.isArray(optionsMap)) return optionsMap;

        const flattened: any[] = [];

        Object.values(optionsMap).forEach((expirationMap: any) => {
            if (Array.isArray(expirationMap)) {
                flattened.push(...expirationMap);
            } else {
                Object.values(expirationMap).forEach((strikesArray: any) => {
                    if (Array.isArray(strikesArray)) {
                        flattened.push(...strikesArray);
                    }
                });
            }
        });

        return flattened;
    }

    /**
     * Retorna métricas por defecto cuando no hay datos disponibles
     */
    private getDefaultMetrics(): GEXMetrics {
        return {
            totalGEX: 0,
            gammaFlip: 0,
            netInstitutionalDelta: 0,
            netDrift: 0,
            callWall: 0,
            putWall: 0,
            currentPrice: 0,
            regime: 'neutral',
            netVanna: 0,
            netCharm: 0,
            callWallStrength: 'uncertain',
            putWallStrength: 'uncertain',
            callWallLiquidity: 0,
            putWallLiquidity: 0,
            pinningTarget: 0,
            pinningConfidence: 0,
            pinningRationale: 'Waiting for data...',
            gammaProfile: []
        };
    }

    /**
     * Retorna métricas MOCK realistas para demostración
     */
    private getMockMetrics(symbol: string): GEXMetrics {
        const now = new Date();
        const hour = now.getHours();

        // Precios base por símbolo
        const basePrices: Record<string, number> = {
            'SPX': 6050.00,
            'SPXW': 6050.00,
            'SPY': 605.00,
            'QQQ': 520.00,
            'IWM': 230.00
        };

        const currentPrice = basePrices[symbol] || 6050.00;

        // Simular variación intradiaria (más volatilidad cerca de la apertura y cierre)
        const isVolatileHour = hour === 9 || hour === 10 || hour === 15 || hour === 16;
        const priceVariation = isVolatileHour ? (Math.random() - 0.5) * 20 : (Math.random() - 0.5) * 10;
        const adjustedPrice = currentPrice + priceVariation;

        // GEX positivo durante horas normales, puede ser negativo en horas volátiles
        const totalGEX = isVolatileHour
            ? (Math.random() - 0.3) * 2000000  // Puede ser negativo
            : Math.random() * 3000000 + 500000; // Siempre positivo

        // Gamma Flip típicamente 0.5-1% por debajo del precio actual
        const gammaFlip = adjustedPrice * (0.985 + Math.random() * 0.01);

        // Net Institutional Delta con sesgo alcista leve
        const netInstitutionalDelta = (Math.random() - 0.4) * 25000;

        // Net Drift basado en el delta
        const netDrift = (netInstitutionalDelta / adjustedPrice) * 100;

        // Muros típicamente 1-2% del precio
        const putWall = Math.round(adjustedPrice * 0.98 / 5) * 5; // Redondear a múltiplo de 5
        const callWall = Math.round(adjustedPrice * 1.02 / 5) * 5;

        // Expected Move típicamente 0.5-1% para 0DTE
        const expectedMove = adjustedPrice * (0.005 + Math.random() * 0.005);

        // Determinar régimen
        let regime: 'stable' | 'volatile' | 'neutral' = 'stable';
        if (totalGEX < 0) {
            regime = 'volatile';
        } else if (Math.abs(totalGEX) < 100000) {
            regime = 'neutral';
        }

        // Vanna y Charm con valores realistas
        const netVanna = (Math.random() - 0.5) * 50000;
        const netCharm = (Math.random() - 0.5) * 10000;

        return {
            totalGEX,
            gammaFlip,
            netInstitutionalDelta,
            netDrift,
            callWall,
            putWall,
            currentPrice: adjustedPrice,
            regime,
            expectedMove,
            netVanna,
            netCharm,
            callWallStrength: Math.random() > 0.3 ? 'solid' : 'weak',
            putWallStrength: Math.random() > 0.3 ? 'solid' : 'weak',
            callWallLiquidity: Math.floor(Math.random() * 20000),
            putWallLiquidity: Math.floor(Math.random() * 20000),
            pinningTarget: Math.round(adjustedPrice / 5) * 5,
            pinningConfidence: 75,
            pinningRationale: 'Mock Prediction: Index Pinning near major strike',
            gammaProfile: this.calculateMockGammaProfile(adjustedPrice, gammaFlip)
        };
    }

    /**
     * Calcula métricas GEX solo para opciones 0DTE
     */
    async calculate0DTEGEXMetrics(symbol: string = 'SPX'): Promise<GEXMetrics> {
        try {
            const chain = await this.schwabService.getOptionsChain(symbol);

            if (!chain) return this.getDefaultMetrics();

            const today = new Date().toLocaleDateString('en-CA');
            const currentPrice = chain.underlying?.last || 0;

            // Filtrar solo opciones 0DTE
            const allOptions = this.flattenOptionsMap(chain.callExpDateMap || chain.calls)
                .concat(this.flattenOptionsMap(chain.putExpDateMap || chain.puts))
                .filter((opt: any) => opt.expirationDate?.startsWith(today));

            if (allOptions.length === 0) {
                console.warn('⚠️ No 0DTE options found for today');
                return this.getDefaultMetrics();
            }

            // Usar la misma lógica de procesamiento pero solo con las opciones filtradas
            return this.processGEXOptions(chain, allOptions);

        } catch (error) {
            console.error('❌ Failed to calculate 0DTE GEX metrics:', error);
            return this.getDefaultMetrics();
        }
    }

    /**
     * Calculate Expected Move based on ATM straddle price
     */
    private calculateExpectedMove(options: any[], currentPrice: number): number {
        try {
            // Find ATM strike (closest to current price)
            const strikes = [...new Set(options.map(o => parseFloat(o.strikePrice || o.strike)))];
            const atmStrike = strikes.reduce((prev, curr) =>
                Math.abs(curr - currentPrice) < Math.abs(prev - currentPrice) ? curr : prev
            );

            // Find ATM call and put
            const atmCall = options.find(o =>
                o.putCall === 'CALL' && Math.abs(parseFloat(o.strikePrice || o.strike) - atmStrike) < 1
            );
            const atmPut = options.find(o =>
                o.putCall === 'PUT' && Math.abs(parseFloat(o.strikePrice || o.strike) - atmStrike) < 1
            );

            if (!atmCall || !atmPut) {
                return 0;
            }

            // Get mid prices
            const callPrice = (atmCall.bid + atmCall.ask) / 2 || atmCall.last || 0;
            const putPrice = (atmPut.bid + atmPut.ask) / 2 || atmPut.last || 0;

            // Expected move is the straddle price
            return callPrice + putPrice;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Calcula la curva teórica de Gamma Exposure
     */
    private calculateGammaProfile(options: any[], currentPrice: number): Array<{ price: number, netGex: number }> {
        const profile: Array<{ price: number, netGex: number }> = [];
        const today = new Date();
        const expirationDate = new Date();
        expirationDate.setHours(16, 0, 0, 0); // Market close 4 PM ET

        // Calcular T real en años. Si el mercado está cerrado, usar 1 día como mínimo para evitar división por cero
        let tReal = (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (tReal <= 0) tReal = 1 / 365;

        // Pre-recolectar datos relevantes para velocidad
        const relevantOptions = options.map(opt => ({
            strike: parseFloat(opt.strikePrice || opt.strike),
            oi: opt.openInterest || 0,
            iv: (opt.volatility || 20) / 100,
            isCall: opt.putCall === 'CALL'
        })).filter(o => o.oi > 0 && o.strike > 0);

        const range = 0.03; // +/- 3%
        const steps = 40;
        const stepSize = (currentPrice * range * 2) / steps;
        const startPrice = currentPrice * (1 - range);

        for (let i = 0; i <= steps; i++) {
            const simulatedPrice = startPrice + i * stepSize;
            let totalNetGex = 0;

            for (const opt of relevantOptions) {
                // Cálculo simplificado de Gamma usando Black-Scholes para la curva
                const gamma = this.calculateBSGamma(simulatedPrice, opt.strike, opt.iv, tReal);
                const gex = gamma * opt.oi * 100 * simulatedPrice;

                if (opt.isCall) {
                    totalNetGex += gex;
                } else {
                    totalNetGex -= gex;
                }
            }

            profile.push({
                price: parseFloat(simulatedPrice.toFixed(2)),
                netGex: totalNetGex
            });
        }

        return profile;
    }

    private calculateBSGamma(S: number, K: number, sigma: number, T: number): number {
        if (T <= 0 || sigma <= 0) return 0;
        const d1 = (Math.log(S / K) + (0.04 + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
        const nPrimeD1 = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * d1 * d1);
        return nPrimeD1 / (S * sigma * Math.sqrt(T));
    }

    private calculateMockGammaProfile(currentPrice: number, flip: number): Array<{ price: number, netGex: number }> {
        const profile = [];
        const range = 0.03;
        const steps = 40;
        const stepSize = (currentPrice * range * 2) / steps;
        const startPrice = currentPrice * (1 - range);

        for (let i = 0; i <= steps; i++) {
            const p = startPrice + i * stepSize;
            // Función sigmoide/logística modificada para simular el perfil GEX
            const x = (p - flip) / (currentPrice * 0.01);
            const gex = (2 / (1 + Math.exp(-x)) - 1) * 1000000;

            profile.push({
                price: parseFloat(p.toFixed(2)),
                netGex: gex
            });
        }
        return profile;
    }
}
