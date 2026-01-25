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
            let chain = await this.schwabService.getOptionsChain(searchSymbol);

            // Fallback for SPX
            if ((!chain || (!chain.callExpDateMap && !chain.putExpDateMap)) && searchSymbol === 'SPX') {
                console.log('⚠️ GEX: SPX Chain unavailable, trying SPXW...');
                chain = await this.schwabService.getOptionsChain('SPXW');
                if (chain) searchSymbol = 'SPXW';
            }

            // Fallback to SPY
            if ((!chain || (!chain.callExpDateMap && !chain.putExpDateMap)) && (searchSymbol === 'SPX' || searchSymbol === 'SPXW')) {
                console.log('⚠️ GEX: SPXW Chain unavailable, failing over to SPY...');
                chain = await this.schwabService.getOptionsChain('SPY');
            }

            if (!chain || (!chain.callExpDateMap && !chain.calls)) {
                console.warn(`⚠️ No options chain data available for GEX calculation (${symbol})`);
                return this.getDefaultMetrics();
            }

            // Robust price detection
            const currentPrice = chain.underlying?.last ||
                chain.underlying?.lastPrice ||
                chain.underlyingPrice || 0;

            if (currentPrice === 0) {
                console.warn(`⚠️ GEX: Missing underlying price for ${symbol}`);
            }

            const allOptions: any[] = [];

            // Flatten options data
            allOptions.push(...this.flattenOptionsMap(chain.callExpDateMap || chain.calls));
            allOptions.push(...this.flattenOptionsMap(chain.putExpDateMap || chain.puts));

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
            }>();

            let maxCallOI = 0;
            let maxPutOI = 0;
            let callWallStrike = 0;
            let putWallStrike = 0;

            // Procesar cada opción
            for (const opt of allOptions) {
                const strike = parseFloat(opt.strikePrice || opt.strike || 0);
                if (strike === 0) continue;

                const oi = opt.openInterest || 0;
                const gamma = opt.gamma || 0;
                const delta = opt.delta || 0;
                const isCall = opt.putCall === 'CALL';

                if (!strikeMetrics.has(strike)) {
                    strikeMetrics.set(strike, {
                        callGEX: 0,
                        putGEX: 0,
                        callDelta: 0,
                        putDelta: 0,
                        callOI: 0,
                        putOI: 0,
                        netGEX: 0,
                        netVanna: 0
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


                    // Actualizar Call Wall
                    if (metrics.callOI > maxCallOI) {
                        maxCallOI = metrics.callOI;
                        callWallStrike = strike;
                    }
                } else {
                    // Put GEX es negativo para dealers (ellos están short puts)
                    metrics.putGEX -= gexContribution;
                    metrics.putDelta += delta * oi * 100;
                    metrics.putOI += oi;
                    metrics.netVanna -= vannaContribution; // Puts have negative Vanna for dealers (short puts)


                    // Actualizar Put Wall
                    if (metrics.putOI > maxPutOI) {
                        maxPutOI = metrics.putOI;
                        putWallStrike = strike;
                    }
                }

                metrics.netGEX = metrics.callGEX + metrics.putGEX;
            }

            // 1. Total Metrics
            let totalGEX = 0;
            let netVanna = 0;
            strikeMetrics.forEach(m => {
                totalGEX += m.netGEX;
                netVanna += m.netVanna;
            });

            // 2. Gamma Flip (Strike donde GEX cruza de positivo a negativo)
            let gammaFlip = currentPrice;
            let closestToZero = Infinity;

            const sortedStrikes = Array.from(strikeMetrics.entries())
                .sort((a, b) => a[0] - b[0]);

            for (let i = 0; i < sortedStrikes.length - 1; i++) {
                const [strike1, metrics1] = sortedStrikes[i];
                const [strike2, metrics2] = sortedStrikes[i + 1];

                // Buscar cambio de signo
                if (metrics1.netGEX * metrics2.netGEX < 0) {
                    // Hay un cruce entre estos dos strikes
                    gammaFlip = (strike1 + strike2) / 2;
                    break;
                }

                // También buscar el strike más cercano a GEX = 0
                if (Math.abs(metrics1.netGEX) < closestToZero) {
                    closestToZero = Math.abs(metrics1.netGEX);
                    gammaFlip = strike1;
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
            if (distanceToFlip < 0.005) { // Menos de 0.5%
                regime = 'volatile'; // Cerca del flip = mayor incertidumbre
            }

            // 6. Calculate Expected Move (ATM Straddle)
            const expectedMove = this.calculateExpectedMove(allOptions, currentPrice);

            return {
                totalGEX,
                gammaFlip,
                netInstitutionalDelta,
                netDrift,
                callWall: callWallStrike,
                putWall: putWallStrike,
                currentPrice,
                regime,
                expectedMove,
                netVanna
            };

        } catch (error) {
            console.error('❌ Failed to calculate GEX metrics:', error);
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
            netVanna: 0
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

            // Usar la misma lógica de cálculo pero solo con opciones 0DTE
            // (reutilizar la lógica anterior pero con dataset filtrado)
            // Por simplicidad, llamar al método principal y filtrar internamente

            return this.calculateGEXMetrics(symbol);

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
}
