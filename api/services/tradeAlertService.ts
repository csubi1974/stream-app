import { SchwabService } from './schwabService.js';
import { GEXService, GEXMetrics } from './gexService.js';
import { getDb } from '../database/sqlite.js';

export interface TradeLeg {
    action: 'BUY' | 'SELL';
    type: 'CALL' | 'PUT';
    strike: number;
    price: number;
    delta: number;
    symbol?: string;
}

export interface QualityFactors {
    moveExhaustion: number;   // 0-10 (10 = no movement, 0 = exhausted)
    expectedMoveUsage: number; // 0-10 (10 = not used, 0 = exceeded)
    wallProximity: number;     // 0-10 (10 = very close to wall)
    timeRemaining: number;     // 0-10 (10 = lots of time, 0 = expiring soon)
    regimeStrength: number;    // 0-10 (10 = very stable regime)
    driftAlignment: number;    // 0-10 (10 = perfect alignment)
}

export interface AlertMetadata {
    openPrice: number;
    moveFromOpen: number;
    movePercent: number;
    moveRatio: number;
    wallDistance: number;
    hoursRemaining: number;
    generatedAtPrice: number;
}

export interface QualityMetrics {
    qualityScore: number;
    qualityLevel: 'PREMIUM' | 'STANDARD' | 'AGGRESSIVE';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    qualityFactors: QualityFactors;
    metadata: AlertMetadata;
}

export interface TradeAlert {
    id: string;
    strategy: 'BULL_PUT_SPREAD' | 'BEAR_CALL_SPREAD' | 'IRON_CONDOR';
    strategyLabel: string;
    underlying: string;
    expiration: string;
    legs: TradeLeg[];
    netCredit: number;
    maxLoss: number;
    maxProfit: number;
    probability: number;
    riskReward: string;
    rationale: string;
    status: 'ACTIVE' | 'WATCH' | 'CANCELLED' | 'EXPIRED';
    gexContext: {
        regime: string;
        callWall: number;
        putWall: number;
        gammaFlip: number;
        currentPrice: number;
        netDrift: number;
        expectedMove?: number; // Expected move for the day (in points)
    };
    generatedAt: string;
    validUntil: string;
    // Quality Scoring (NEW)
    qualityScore?: number;
    qualityLevel?: 'PREMIUM' | 'STANDARD' | 'AGGRESSIVE';
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    qualityFactors?: QualityFactors;
    metadata?: AlertMetadata;
    exitCriteria?: {
        profitTarget: string;
        stopLoss: string;
        timeExit: string;
    };
}

export class TradeAlertService {
    private schwabService: SchwabService;
    private gexService: GEXService;
    private readonly SPREAD_WIDTH = 5; // 5 points for SPX

    constructor(schwabService: SchwabService) {
        this.schwabService = schwabService;
        this.gexService = new GEXService(schwabService);
    }

    /**
     * Get hours remaining until market close (4 PM ET)
     */
    private getHoursUntilClose(): number {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });

        const parts = formatter.formatToParts(now);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value;

        const hour = parseInt(getPart('hour') || '0');
        const minute = parseInt(getPart('minute') || '0');

        const currentMinutes = hour * 60 + minute;
        const closeMinutes = 16 * 60; // 4:00 PM

        const minutesRemaining = closeMinutes - currentMinutes;
        return Math.max(0, minutesRemaining / 60);
    }

    /**
     * Get opening price from chain data
     */
    private getOpenPrice(chain: any, currentPrice: number): number {
        return chain?.underlying?.open || currentPrice;
    }

    /**
     * Calculate quality score for a trade alert
     */
    private calculateQualityScore(
        gexContext: any,
        shortStrike: number,
        currentPrice: number,
        openPrice: number,
        expectedMove: number,
        wall: number,
        type: 'BULL_PUT' | 'BEAR_CALL'
    ): QualityMetrics {
        const { regime, netDrift, totalGEX } = gexContext;

        // Calculate metadata
        const moveFromOpen = currentPrice - openPrice;
        const movePercent = Math.abs((moveFromOpen / openPrice) * 100);
        const moveRatio = Math.abs(moveFromOpen) / Math.max(expectedMove, 1);
        const wallDistance = Math.abs(shortStrike - wall);
        const hoursRemaining = this.getHoursUntilClose();

        // Calculate individual quality factors (0-10 scale)

        // 1. Move Exhaustion (10 = fresh, 0 = exhausted)
        let moveExhaustion = 10;
        if (moveRatio > 2.0) moveExhaustion = 0;
        else if (moveRatio > 1.5) moveExhaustion = 2;
        else if (moveRatio > 1.0) moveExhaustion = 4;
        else if (moveRatio > 0.7) moveExhaustion = 6;
        else if (moveRatio > 0.5) moveExhaustion = 8;

        // 2. Expected Move Usage (10 = not used, 0 = exceeded)
        let expectedMoveUsage = 10;
        if (moveRatio > 2.0) expectedMoveUsage = 0;
        else if (moveRatio > 1.5) expectedMoveUsage = 2;
        else if (moveRatio > 1.0) expectedMoveUsage = 4;
        else if (moveRatio > 0.75) expectedMoveUsage = 6;
        else if (moveRatio > 0.5) expectedMoveUsage = 8;

        // 3. Wall Proximity (10 = very close, 0 = very far)
        let wallProximity = 10;
        if (wallDistance > 50) wallProximity = 1;
        else if (wallDistance > 40) wallProximity = 3;
        else if (wallDistance > 30) wallProximity = 5;
        else if (wallDistance > 20) wallProximity = 7;
        else if (wallDistance > 10) wallProximity = 9;

        // 4. Time Remaining (10 = lots of time, 0 = expiring soon)
        let timeRemaining = 10;
        if (hoursRemaining < 1) timeRemaining = 1;
        else if (hoursRemaining < 1.5) timeRemaining = 3;
        else if (hoursRemaining < 2.5) timeRemaining = 5;
        else if (hoursRemaining < 3.5) timeRemaining = 7;
        else if (hoursRemaining < 5) timeRemaining = 9;

        // 5. Regime Strength (10 = very stable, 0 = volatile)
        let regimeStrength = 5;
        if (regime === 'volatile') regimeStrength = 1;
        else if (regime === 'neutral') regimeStrength = 5;
        else if (regime === 'stable') {
            if (Math.abs(totalGEX || 0) > 1000000) regimeStrength = 10;
            else if (Math.abs(totalGEX || 0) > 500000) regimeStrength = 8;
            else regimeStrength = 7;
        }

        // 6. Drift Alignment (10 = perfect alignment, 0 = against drift)
        let driftAlignment = 5;
        const absDrift = Math.abs(netDrift);

        if (type === 'BULL_PUT') {
            // Bull Put wants positive drift (bullish bias)
            if (netDrift > 1.0) driftAlignment = 10;
            else if (netDrift > 0.7) driftAlignment = 9;
            else if (netDrift > 0.5) driftAlignment = 8;
            else if (netDrift > 0.2) driftAlignment = 6;
            else if (netDrift > 0) driftAlignment = 5;
            else driftAlignment = 3; // Against drift
        } else {
            // Bear Call wants negative drift (bearish bias)
            if (netDrift < -1.0) driftAlignment = 10;
            else if (netDrift < -0.7) driftAlignment = 9;
            else if (netDrift < -0.5) driftAlignment = 8;
            else if (netDrift < -0.2) driftAlignment = 6;
            else if (netDrift < 0) driftAlignment = 5;
            else driftAlignment = 3; // Against drift
        }

        const qualityFactors: QualityFactors = {
            moveExhaustion,
            expectedMoveUsage,
            wallProximity,
            timeRemaining,
            regimeStrength,
            driftAlignment
        };

        // Calculate overall quality score (weighted average)
        const weights = {
            moveExhaustion: 0.25,      // 25% - Most important
            expectedMoveUsage: 0.20,    // 20%
            wallProximity: 0.20,        // 20%
            timeRemaining: 0.15,        // 15%
            regimeStrength: 0.10,       // 10%
            driftAlignment: 0.10        // 10%
        };

        const qualityScore = Math.round(
            moveExhaustion * weights.moveExhaustion * 10 +
            expectedMoveUsage * weights.expectedMoveUsage * 10 +
            wallProximity * weights.wallProximity * 10 +
            timeRemaining * weights.timeRemaining * 10 +
            regimeStrength * weights.regimeStrength * 10 +
            driftAlignment * weights.driftAlignment * 10
        );

        // Determine quality level
        let qualityLevel: 'PREMIUM' | 'STANDARD' | 'AGGRESSIVE';
        if (qualityScore >= 80) qualityLevel = 'PREMIUM';
        else if (qualityScore >= 60) qualityLevel = 'STANDARD';
        else qualityLevel = 'AGGRESSIVE';

        // Determine risk level
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        if (moveRatio > 1.5 || hoursRemaining < 1.5) riskLevel = 'HIGH';
        else if (moveRatio > 1.0 || hoursRemaining < 2.5 || wallDistance > 35) riskLevel = 'MEDIUM';
        else riskLevel = 'LOW';

        const metadata: AlertMetadata = {
            openPrice,
            moveFromOpen,
            movePercent,
            moveRatio,
            wallDistance,
            hoursRemaining,
            generatedAtPrice: currentPrice
        };

        console.log(`📊 Quality Score: ${qualityScore} (${qualityLevel}) | Risk: ${riskLevel} | Move Ratio: ${moveRatio.toFixed(2)}× | Hours: ${hoursRemaining.toFixed(1)}`);

        return {
            qualityScore,
            qualityLevel,
            riskLevel,
            qualityFactors,
            metadata
        };
    }


    /**
     * Generate trade alerts based on current market conditions
     */
    async generateAlerts(symbol: string = 'SPX'): Promise<TradeAlert[]> {
        try {
            // 1. Check if market is in valid trading window
            const tradingWindow = this.getTradingWindow();
            if (!tradingWindow.isOpen) {
                console.log(`⏰ Market closed. Window: ${tradingWindow.status}`);
                return [];
            }

            // 2. Get GEX metrics for context
            const gexMetrics = await this.gexService.calculateGEXMetrics(symbol);
            if (!gexMetrics || gexMetrics.currentPrice === 0) {
                console.warn('⚠️ No GEX metrics available for alert generation');
                return [];
            }

            // 3. Get options chain
            const chain = await this.schwabService.getOptionsChain(symbol);
            if (!chain) {
                console.warn('⚠️ No options chain available');
                return [];
            }

            // 4. Find today's/next expiration
            const targetExpiration = this.findTargetExpiration(chain);
            if (!targetExpiration) {
                console.warn('⚠️ No valid expiration found');
                return [];
            }

            // 5. Flatten options for the target expiration
            const options = this.getOptionsForExpiration(chain, targetExpiration);
            if (options.length === 0) {
                console.warn('⚠️ No options for target expiration');
                return [];
            }

            // 6. Generate alerts based on regime
            const alerts: TradeAlert[] = [];
            const { regime, netDrift, callWall, putWall, gammaFlip, currentPrice, totalGEX } = gexMetrics;

            // Calculate expected move
            const expectedMove = this.calculateExpectedMove(options, currentPrice);

            // Get opening price for quality scoring
            const openPrice = this.getOpenPrice(chain, currentPrice);

            console.log(`📊 Generating alerts for ${symbol} | Regime: ${regime} | Drift: ${netDrift.toFixed(2)} | Expected Move: ±${expectedMove.toFixed(2)} | Open: $${openPrice.toFixed(2)}`);

            // Context for all alerts
            const gexContext = {
                regime,
                callWall,
                putWall,
                gammaFlip,
                currentPrice,
                netDrift,
                expectedMove,
                totalGEX,  // Add totalGEX for quality scoring
                openPrice  // Add openPrice for move exhaustion calculation
            };


            // Strategy Selection based on Regime
            if (regime === 'stable') {
                // Stable regime: Iron Condor (sell premium on both sides)
                const ironCondor = this.generateIronCondor(options, gexMetrics, targetExpiration, gexContext);
                if (ironCondor) alerts.push(ironCondor);
            }

            // Directional strategies based on Net Drift
            if (netDrift > 0.5) {
                // Bullish bias: Bull Put Spread
                const bullPut = this.generateBullPutSpread(options, gexMetrics, targetExpiration, gexContext);
                if (bullPut) alerts.push(bullPut);
            }

            if (netDrift < -0.5) {
                // Bearish bias: Bear Call Spread
                const bearCall = this.generateBearCallSpread(options, gexMetrics, targetExpiration, gexContext);
                if (bearCall) alerts.push(bearCall);
            }

            // 3. Vanna Crush Play (Independent of Drift)
            if (gexMetrics.netVanna > 15000000 && regime !== 'volatile') {
                const bullPut = this.generateBullPutSpread(options, gexMetrics, targetExpiration, gexContext, 'vanna_crush');
                if (bullPut && !alerts.find(a => a.id === bullPut.id)) alerts.push(bullPut);
            }

            if (gexMetrics.netVanna < -10000000 && regime !== 'volatile') {
                const bearCall = this.generateBearCallSpread(options, gexMetrics, targetExpiration, gexContext, 'vanna_crush');
                if (bearCall && !alerts.find(a => a.id === bearCall.id)) alerts.push(bearCall);
            }

            // Neutral drift but stable: Also suggest spreads near walls
            if (Math.abs(netDrift) <= 0.5 && regime === 'stable') {
                const bullPut = this.generateBullPutSpread(options, gexMetrics, targetExpiration, gexContext);
                if (bullPut && !alerts.find(a => a.id === bullPut.id)) alerts.push(bullPut);

                const bearCall = this.generateBearCallSpread(options, gexMetrics, targetExpiration, gexContext);
                if (bearCall && !alerts.find(a => a.id === bearCall.id)) alerts.push(bearCall);
            }

            // Volatile regime warning
            if (regime === 'volatile') {
                alerts.push({
                    id: `warning-${Date.now()}`,
                    strategy: 'BEAR_CALL_SPREAD', // placeholder
                    strategyLabel: '⚠️ Régimen Volátil Detectado',
                    underlying: symbol,
                    expiration: targetExpiration,
                    legs: [],
                    netCredit: 0,
                    maxLoss: 0,
                    maxProfit: 0,
                    probability: 0,
                    riskReward: 'N/A',
                    rationale: 'El mercado está en régimen volátil. Los dealers amplifican movimientos. Evitar venta de premium o usar tamaño reducido.',
                    status: 'WATCH',
                    gexContext,
                    generatedAt: new Date().toISOString(),
                    validUntil: this.getValidUntil()
                });
            }

            // Save alerts to database for history
            await this.saveAlertsToDb(alerts);

            console.log(`✅ Generated ${alerts.length} trade alerts`);
            return alerts;

        } catch (error) {
            console.error('❌ Error generating trade alerts:', error);
            return [];
        }
    }

    /**
     * Generate Bull Put Spread (Credit Spread)
     */
    private generateBullPutSpread(
        options: any[],
        gexMetrics: GEXMetrics,
        expiration: string,
        gexContext: any,
        trigger?: 'vanna_crush' | 'drift' | 'wall'
    ): TradeAlert | null {
        try {
            const puts = options.filter(o => o.putCall === 'PUT');
            const { putWall, currentPrice } = gexMetrics;
            const { expectedMove } = gexContext;

            // Calculate expected range
            const lowerBound = currentPrice - (expectedMove || 0);
            const upperBound = currentPrice + (expectedMove || 0);

            console.log(`📍 Bull Put Spread: Expected Range $${lowerBound.toFixed(0)} - $${upperBound.toFixed(0)}`);

            // Find short put candidates: Below current price, near put wall, delta around 0.15-0.25
            const shortPutCandidates = puts
                .filter(p => {
                    const strike = parseFloat(p.strikePrice || p.strike);
                    const delta = Math.abs(p.delta || 0);
                    return strike < currentPrice &&
                        strike >= putWall - 20 &&
                        delta >= 0.15 && delta <= 0.25;
                })
                .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

            if (shortPutCandidates.length === 0) return null;

            const shortPut = shortPutCandidates[0];
            const shortStrike = parseFloat(shortPut.strikePrice || shortPut.strike);
            const longStrike = shortStrike - this.SPREAD_WIDTH;

            // Generate unique deterministic ID
            const alertId = `BPS-${expiration}-${shortStrike}`.replace(/:/g, '-');

            // Find long put
            const longPut = puts.find(p => {
                const strike = parseFloat(p.strikePrice || p.strike);
                return Math.abs(strike - longStrike) < 1;
            });

            if (!longPut) return null;

            const shortPrice = (shortPut.bid + shortPut.ask) / 2 || shortPut.last || 0;
            const longPrice = (longPut.bid + longPut.ask) / 2 || longPut.last || 0;
            const netCredit = shortPrice - longPrice;

            if (netCredit <= 0.20) return null; // Minimum credit threshold

            const maxLoss = this.SPREAD_WIDTH - netCredit;
            const probability = 1 - Math.abs(shortPut.delta || 0.25);

            // Determine status based on expected move
            let status: 'ACTIVE' | 'WATCH' = 'ACTIVE';
            let riskWarning = '';

            if (expectedMove && shortStrike >= lowerBound) {
                status = 'WATCH';
                riskWarning = ' ⚠️ DENTRO del rango esperado - Mayor riesgo';
            }

            // Calculate quality score
            const quality = this.calculateQualityScore(
                gexContext,
                shortStrike,
                currentPrice,
                gexContext.openPrice,
                expectedMove || 0,
                putWall,
                'BULL_PUT'
            );

            // Calculate Exit Criteria
            const stopPrice = expectedMove ? Math.max(lowerBound, shortStrike + 5) : shortStrike + 5;
            const exitCriteria = {
                profitTarget: "100% (Dejar Expirar)",
                stopLoss: `Cerrar si SPX baja a ${stopPrice.toFixed(0)} (Risk Zone)`,
                timeExit: "Cerrar a las 3:45 PM si SPX está a <10 pts del strike"
            };

            return {
                id: alertId,
                strategy: 'BULL_PUT_SPREAD',
                strategyLabel: 'Bull Put Spread',
                underlying: 'SPX',
                expiration,
                legs: [
                    {
                        action: 'SELL',
                        type: 'PUT',
                        strike: shortStrike,
                        price: shortPrice,
                        delta: shortPut.delta || 0
                    },
                    {
                        action: 'BUY',
                        type: 'PUT',
                        strike: longStrike,
                        price: longPrice,
                        delta: longPut.delta || 0
                    }
                ],
                netCredit: parseFloat(netCredit.toFixed(2)),
                maxLoss: parseFloat(maxLoss.toFixed(2)),
                maxProfit: parseFloat(netCredit.toFixed(2)),
                probability: parseFloat((probability * 100).toFixed(1)),
                riskReward: `1:${(maxLoss / netCredit).toFixed(1)}`,
                rationale: trigger === 'vanna_crush'
                    ? `ESTRATEGIA VANNA CRUSH: El Net Vanna es altamente positivo (${(gexMetrics.netVanna / 1e6).toFixed(1)}M), lo que significa que un colapso de volatilidad (IV Crush) forzará a los Dealers a comprar acciones, empujando el precio al alza independientemente del drift actual. Se vende premium aprovechando este viento a favor institucional.`
                    : `El Put Wall en $${putWall.toFixed(0)} actúa como un imán y soporte institucional clave para el mercado hoy. El strike corto de $${shortStrike.toFixed(0)} se ha seleccionado para estar ${expectedMove ? (shortStrike < lowerBound ? `FUERA de las fronteras del Movimiento Esperado (±$${expectedMove.toFixed(1)})` : `DENTRO del rango del Movimiento Esperado`) : 'en una zona técnica de alta probabilidad'}. Bajo este régimen ${gexContext.regime === 'stable' ? 'estable' : 'volátil'}, los Dealers tienden a amortiguar las caídas cerca de estos niveles de soporte.`,
                status,
                gexContext,
                generatedAt: new Date().toISOString(),
                validUntil: this.getValidUntil(),
                // Quality Scoring
                qualityScore: quality.qualityScore,
                qualityLevel: quality.qualityLevel,
                riskLevel: quality.riskLevel,
                qualityFactors: quality.qualityFactors,
                metadata: quality.metadata,
                exitCriteria // New field
            };
        } catch (error) {
            console.error('Error generating Bull Put Spread:', error);
            return null;
        }
    }

    /**
     * Generate Bear Call Spread (Credit Spread)
     */
    private generateBearCallSpread(
        options: any[],
        gexMetrics: GEXMetrics,
        expiration: string,
        gexContext: any,
        trigger?: 'vanna_crush' | 'drift' | 'wall'
    ): TradeAlert | null {
        try {
            const calls = options.filter(o => o.putCall === 'CALL');
            const { callWall, currentPrice } = gexMetrics;
            const { expectedMove } = gexContext;

            // Calculate expected range
            const lowerBound = currentPrice - (expectedMove || 0);
            const upperBound = currentPrice + (expectedMove || 0);

            console.log(`📍 Bear Call Spread: Expected Range $${lowerBound.toFixed(0)} - $${upperBound.toFixed(0)}`);

            // Find short call candidates: Above current price, near call wall, delta around 0.15-0.25
            const shortCallCandidates = calls
                .filter(c => {
                    const strike = parseFloat(c.strikePrice || c.strike);
                    const delta = Math.abs(c.delta || 0);
                    return strike > currentPrice &&
                        strike <= callWall + 20 &&
                        delta >= 0.15 && delta <= 0.25;
                })
                .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

            if (shortCallCandidates.length === 0) return null;

            const shortCall = shortCallCandidates[0];
            const shortStrike = parseFloat(shortCall.strikePrice || shortCall.strike);
            const longStrike = shortStrike + this.SPREAD_WIDTH;

            // Generate unique deterministic ID
            const alertId = `BCS-${expiration}-${shortStrike}`.replace(/:/g, '-');

            // Find long call
            const longCall = calls.find(c => {
                const strike = parseFloat(c.strikePrice || c.strike);
                return Math.abs(strike - longStrike) < 1;
            });

            if (!longCall) return null;

            const shortPrice = (shortCall.bid + shortCall.ask) / 2 || shortCall.last || 0;
            const longPrice = (longCall.bid + longCall.ask) / 2 || longCall.last || 0;
            const netCredit = shortPrice - longPrice;

            if (netCredit <= 0.20) return null;

            const maxLoss = this.SPREAD_WIDTH - netCredit;
            const probability = 1 - Math.abs(shortCall.delta || 0.25);

            // Determine status based on expected move
            let status: 'ACTIVE' | 'WATCH' = 'ACTIVE';

            if (expectedMove && shortStrike <= upperBound) {
                status = 'WATCH';
            }

            // Calculate quality score
            const quality = this.calculateQualityScore(
                gexContext,
                shortStrike,
                currentPrice,
                gexContext.openPrice,
                expectedMove || 0,
                callWall,
                'BEAR_CALL'
            );

            // Calculate Exit Criteria
            const stopPrice = expectedMove ? Math.min(upperBound, shortStrike - 5) : shortStrike - 5;
            const exitCriteria = {
                profitTarget: "100% (Dejar Expirar)",
                stopLoss: `Cerrar si SPX sube a ${stopPrice.toFixed(0)} (Rompe Estructura)`,
                timeExit: "Cerrar a las 3:45 PM si SPX está a <10 pts del strike"
            };

            return {
                id: alertId,
                strategy: 'BEAR_CALL_SPREAD',
                strategyLabel: 'Bear Call Spread',
                underlying: 'SPX',
                expiration,
                legs: [
                    {
                        action: 'SELL',
                        type: 'CALL',
                        strike: shortStrike,
                        price: shortPrice,
                        delta: shortCall.delta || 0
                    },
                    {
                        action: 'BUY',
                        type: 'CALL',
                        strike: longStrike,
                        price: longPrice,
                        delta: longCall.delta || 0
                    }
                ],
                netCredit: parseFloat(netCredit.toFixed(2)),
                maxLoss: parseFloat(maxLoss.toFixed(2)),
                maxProfit: parseFloat(netCredit.toFixed(2)),
                probability: parseFloat((probability * 100).toFixed(1)),
                riskReward: `1:${(maxLoss / netCredit).toFixed(1)}`,
                rationale: trigger === 'vanna_crush'
                    ? `ESTRATEGIA VANNA CRUSH: El Net Vanna es negativo (${(gexMetrics.netVanna / 1e6).toFixed(1)}M). Un colapso de volatilidad (IV Crush) resultará en ventas institucionales por cobertura, presionando el precio a la baja. Se vende Bear Call Spread para capturar este movimiento estructural.`
                    : `El Call Wall en $${callWall.toFixed(0)} representa la frontera superior de liquidez y es la resistencia estadística más importante del día. El strike vendido de $${shortStrike.toFixed(0)} está ${expectedMove ? (shortStrike > upperBound ? `PROTEGIDO fuera del Movimiento Esperado (±$${expectedMove.toFixed(1)})` : `DENTRO del rango proyectado del Movimiento Esperado`) : 'en una zona de fuerte resistencia de gamma'}. En este contexto de Gamma negativa para Dealers, el Call Wall suele actuar como un techo sólido que frena las subidas aceleradas.`,
                status,
                gexContext,
                generatedAt: new Date().toISOString(),
                validUntil: this.getValidUntil(),
                // Quality Scoring
                qualityScore: quality.qualityScore,
                qualityLevel: quality.qualityLevel,
                riskLevel: quality.riskLevel,
                qualityFactors: quality.qualityFactors,
                metadata: quality.metadata,
                exitCriteria // New field
            };
        } catch (error) {
            console.error('Error generating Bear Call Spread:', error);
            return null;
        }
    }

    /**
     * Generate Iron Condor (Both sides credit spreads)
     */
    private generateIronCondor(
        options: any[],
        gexMetrics: GEXMetrics,
        expiration: string,
        gexContext: any
    ): TradeAlert | null {
        try {
            const bullPut = this.generateBullPutSpread(options, gexMetrics, expiration, gexContext);
            const bearCall = this.generateBearCallSpread(options, gexMetrics, expiration, gexContext);

            if (!bullPut || !bearCall) return null;

            const combinedLegs = [...bullPut.legs, ...bearCall.legs];
            const totalCredit = bullPut.netCredit + bearCall.netCredit;
            const maxLoss = this.SPREAD_WIDTH - totalCredit;

            // Generate unique deterministic ID
            const alertId = `IC-${expiration}-${bullPut.legs[0].strike}-${bearCall.legs[0].strike}`.replace(/:/g, '-');

            // Combined probability (both sides need to work)
            const probability = Math.min(bullPut.probability, bearCall.probability);

            return {
                id: alertId,
                strategy: 'IRON_CONDOR',
                strategyLabel: 'Iron Condor',
                underlying: 'SPX',
                expiration,
                legs: combinedLegs,
                netCredit: parseFloat(totalCredit.toFixed(2)),
                maxLoss: parseFloat(maxLoss.toFixed(2)),
                maxProfit: parseFloat(totalCredit.toFixed(2)),
                probability: parseFloat(probability.toFixed(1)),
                riskReward: `1:${(maxLoss / totalCredit).toFixed(1)}`,
                rationale: `Ideal para captura de Theta en un régimen ${gexContext.regime === 'stable' ? 'estable con Dealers en Gamma Positiva' : 'neutral'}. El precio se proyecta contenido dentro del rango de Muros ($${gexContext.putWall.toFixed(0)} - $${gexContext.callWall.toFixed(0)}). Esta estrategia aprovecha la compresión de volatilidad implícita y la defensa de los Market Makers en ambos extremos.`,
                status: 'ACTIVE',
                gexContext,
                generatedAt: new Date().toISOString(),
                validUntil: this.getValidUntil()
            };
        } catch (error) {
            console.error('Error generating Iron Condor:', error);
            return null;
        }
    }

    /**
     * Check current trading window
     */
    private getTradingWindow(): { isOpen: boolean; status: string } {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
            weekday: 'long'
        });

        const parts = formatter.formatToParts(now);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value;

        const hour = parseInt(getPart('hour') || '0');
        const minute = parseInt(getPart('minute') || '0');
        const weekday = getPart('weekday');

        const currentTime = hour * 60 + minute;
        const marketOpen = 9 * 60 + 30;  // 9:30 AM
        const marketClose = 16 * 60;      // 4:00 PM
        const lastAlertTime = 15 * 60 + 45; // 3:45 PM (stop generating new alerts)

        const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';

        if (isWeekend) {
            return { isOpen: false, status: 'WEEKEND' };
        }

        if (currentTime < marketOpen) {
            return { isOpen: false, status: 'PRE_MARKET' };
        }

        if (currentTime >= marketClose) {
            return { isOpen: false, status: 'AFTER_HOURS' };
        }

        if (currentTime >= lastAlertTime) {
            return { isOpen: true, status: 'CLOSING_WINDOW' };
        }

        return { isOpen: true, status: 'ACTIVE' };
    }

    /**
     * Find target expiration (today or next available)
     */
    private findTargetExpiration(chain: any): string | null {
        const today = new Date().toLocaleDateString('en-CA');
        const allDates = new Set<string>();

        if (chain.callExpDateMap) {
            Object.keys(chain.callExpDateMap).forEach(date => allDates.add(date.split(':')[0]));
        }
        if (chain.putExpDateMap) {
            Object.keys(chain.putExpDateMap).forEach(date => allDates.add(date.split(':')[0]));
        }

        const sorted = Array.from(allDates).sort();

        // Try today first
        const todayMatch = sorted.find(d => d.startsWith(today));
        if (todayMatch) return todayMatch;

        // Otherwise next available
        const nextDate = sorted.find(d => d >= today);
        return nextDate || sorted[0] || null;
    }

    /**
     * Get options for a specific expiration
     */
    private getOptionsForExpiration(chain: any, expiration: string): any[] {
        const options: any[] = [];

        if (chain.callExpDateMap) {
            Object.entries(chain.callExpDateMap).forEach(([dateKey, strikes]: [string, any]) => {
                if (dateKey.startsWith(expiration)) {
                    Object.values(strikes).forEach((arr: any) => {
                        if (Array.isArray(arr)) options.push(...arr);
                    });
                }
            });
        }

        if (chain.putExpDateMap) {
            Object.entries(chain.putExpDateMap).forEach(([dateKey, strikes]: [string, any]) => {
                if (dateKey.startsWith(expiration)) {
                    Object.values(strikes).forEach((arr: any) => {
                        if (Array.isArray(arr)) options.push(...arr);
                    });
                }
            });
        }

        return options;
    }

    /**
     * Calculate validity period for alerts
     */
    private getValidUntil(): string {
        const now = new Date();
        // Valid until 3:50 PM ET or 2 hours from now, whichever is sooner
        const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        return twoHoursLater.toISOString();
    }

    /**
     * Calculate Expected Move based on ATM straddle price
     * Expected Move = (ATM Call Price + ATM Put Price)
     * This represents the market's implied volatility expectation
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
                console.warn('⚠️ Could not find ATM options for expected move calculation');
                return 0;
            }

            // Get mid prices
            const callPrice = (atmCall.bid + atmCall.ask) / 2 || atmCall.last || 0;
            const putPrice = (atmPut.bid + atmPut.ask) / 2 || atmPut.last || 0;

            // Expected move is the straddle price
            const straddlePrice = callPrice + putPrice;

            console.log(`📐 Expected Move Calculation: ATM Strike ${atmStrike} | Call: $${callPrice.toFixed(2)} | Put: $${putPrice.toFixed(2)} | Straddle: $${straddlePrice.toFixed(2)}`);

            return straddlePrice;
        } catch (error) {
            console.error('Error calculating expected move:', error);
            return 0;
        }
    }

    /**
     * Save generated alerts to SQLite database
     */
    private async saveAlertsToDb(alerts: TradeAlert[]) {
        try {
            const db = getDb();
            const now = new Date().toISOString();

            for (const alert of alerts) {
                // Ignore warning alerts for database storage if needed
                if (alert.id.startsWith('warning')) continue;

                try {
                    // Use INSERT OR IGNORE to avoid errors on duplicate IDs (same strike/expiry)
                    await db.run(`
                        INSERT OR IGNORE INTO trade_alerts (
                            id, strategy, underlying, generated_at, status, alert_data,
                            quality_score, quality_level, risk_level, quality_metadata,
                            exit_criteria
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        alert.id,
                        alert.strategy,
                        alert.underlying,
                        alert.generatedAt,
                        alert.status,
                        JSON.stringify(alert),
                        alert.qualityScore || null,
                        alert.qualityLevel || null,
                        alert.riskLevel || null,
                        alert.metadata ? JSON.stringify(alert.metadata) : null,
                        alert.exitCriteria ? JSON.stringify(alert.exitCriteria) : null
                    ]);
                } catch (saveError) {
                    console.error(`❌ Error saving alert ${alert.id}:`, saveError);
                }
            }
        } catch (dbError) {
            console.error('❌ Database access error in saveAlertsToDb:', dbError);
        }
    }
    /**
     * Get historical alerts from database
     */
    async getAlertHistory(date?: string, symbol: string = 'SPX'): Promise<TradeAlert[]> {
        try {
            const db = getDb();
            let query = 'SELECT alert_data FROM trade_alerts WHERE underlying = ?';
            const params: any[] = [symbol];

            if (date) {
                query += ' AND generated_at LIKE ?';
                params.push(`${date}%`);
            }

            query += ' ORDER BY generated_at DESC LIMIT 100';

            const rows = await db.all(query, params);
            return rows.map((row: any) => JSON.parse(row.alert_data));
        } catch (error) {
            console.error('❌ Error fetching alert history:', error);
            return [];
        }
    }

    /**
     * Update the result of an alert (Settlement)
     */
    async updateAlertResult(
        alertId: string,
        result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'EXPIRED',
        realizedPnl: number,
        closedAtPrice: number
    ) {
        try {
            const db = getDb();
            const status = result === 'WIN' || result === 'LOSS' || result === 'BREAKEVEN' ? 'CLOSED' : 'EXPIRED';

            await db.run(`
                UPDATE trade_alerts 
                SET result = ?, realized_pnl = ?, closed_at_price = ?, status = ?
                WHERE id = ?
            `, [result, realizedPnl, closedAtPrice, status, alertId]);

            console.log(`✅ Updated result for alert ${alertId}: ${result} ($${realizedPnl})`);
            return true;
        } catch (error) {
            console.error(`❌ Error updating alert result for ${alertId}:`, error);
            return false;
        }
    }
}
