import { SchwabService } from './schwabService.js';
import { GEXService, GEXMetrics } from './gexService.js';
import { getDb } from '../database/sqlite.js';

console.log('🔄 TradeAlertService Loaded v3 (Robust PnL)');

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
    performance?: {
        currentPrice: number;
        unrealizedPnL: number;
        unrealizedPnLPercent: number;
        lastUpdated: string;
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
     * Get historical alerts from database with real-time PnL
     */
    async getAlertHistory(date?: string, symbol: string = 'SPX'): Promise<TradeAlert[]> {
        const db = getDb();
        let alerts: TradeAlert[] = [];

        try {
            console.log(`📜 getAlertHistory called for ${symbol} date=${date}`);

            let query = 'SELECT alert_data FROM trade_alerts WHERE underlying = ?';
            const params: any[] = [symbol];

            if (date) {
                query += ' AND generated_at LIKE ?';
                params.push(`${date}%`);
            }

            query += ' ORDER BY generated_at DESC LIMIT 100';

            const rows = await db.all(query, params);
            // console.log(`📜 Found ${rows.length} alerts in DB`);

            alerts = rows.map((row: any) => {
                const alert = JSON.parse(row.alert_data);
                // Merge latest settlement data from DB columns if available
                return {
                    ...alert,
                    result: row.result || alert.result,
                    realizedPnL: row.realized_pnl != null ? row.realized_pnl : alert.realizedPnL,
                    closedAtPrice: row.closed_at_price != null ? row.closed_at_price : alert.closedAtPrice,
                    status: row.status || alert.status
                };
            });

            // Try to Enrich with Real-Time PnL
            // Only enrich if status is still active or watch
            try {
                const activeAlerts = alerts.filter(a => a.status === 'ACTIVE' || a.status === 'WATCH');
                const nonActive = alerts.filter(a => a.status !== 'ACTIVE' && a.status !== 'WATCH');

                if (activeAlerts.length > 0) {
                    const enriched = await this.enrichAlertsWithPnL(activeAlerts);
                    return [...enriched, ...nonActive];
                }
                return alerts;
            } catch (pnlError) {
                console.error('⚠️ PnL enrichment failed, returning base alerts:', pnlError);
                return alerts;
            }
        } catch (error) {
            console.error('❌ Error fetching alert history:', error);
            // Return whatever we have if DB fetch succeeded partially logic? No, if fetch fails, return empty.
            // But if alerts populated, return them.
            return alerts.length > 0 ? alerts : [];
        }
    }

    /**
     * Calculate current PnL for a list of alerts
     */
    private async enrichAlertsWithPnL(alerts: TradeAlert[]): Promise<TradeAlert[]> {
        if (alerts.length === 0) return [];

        try {
            const uniqueSymbols = new Set<string>();

            // 1. Identify symbols needed and map them
            alerts.forEach(alert => {
                // Collect symbols for ALL alerts to show history performance
                // if (alert.status !== 'ACTIVE' && alert.status !== 'WATCH') return;

                alert.legs.forEach(leg => {
                    let symbol = leg.symbol;
                    if (!symbol) {
                        try {
                            let root = alert.underlying;
                            if (root === 'SPX') root = 'SPXW';

                            const [year, month, day] = alert.expiration.split('-');
                            const opraDate = `${year.slice(2)}${month}${day}`;

                            const type = leg.type === 'CALL' ? 'C' : 'P';
                            const strike = (Math.round(leg.strike * 1000)).toString().padStart(8, '0');

                            // Schwab format padding
                            symbol = `${root.padEnd(6, ' ')}${opraDate}${type}${strike}`;
                            leg.symbol = symbol;
                        } catch (e) {
                            return;
                        }
                    }
                    if (symbol) uniqueSymbols.add(symbol);
                });
            });

            // Always add the underlying index to see the current spot price
            uniqueSymbols.add('$SPX');

            if (uniqueSymbols.size === 0) return alerts;

            console.log(`🔍 [PnL] Checking quotes for ${uniqueSymbols.size} symbols`);

            // 2. Fetch Quotes
            const symbolsArray = Array.from(uniqueSymbols);
            let quotes: any = {};

            try {
                quotes = await this.schwabService.getQuotes(symbolsArray);
            } catch (quoteError) {
                console.warn('⚠️ Schwab quote fetch failed:', quoteError);
                // Dont fail, continue with empty quotes (will trigger fallback logic)
            }

            // 3. Calculate PnL per alert
            return alerts.map(alert => {
                // Determine closing prices even if alert is EXPIRED or WATCH
                // We want to see performance history for everything fetched

                // Update spot price if available from fresh quotes
                const spxQuote = quotes['$SPX']?.quote;
                if (spxQuote) {
                    const spxPrice = spxQuote.lastPrice || spxQuote.closePrice || alert.gexContext.currentPrice;
                    alert.gexContext.currentPrice = spxPrice;
                }

                let currentCostToClose = 0;
                let dataMissing = false;

                for (const leg of alert.legs) {
                    let mark = 0;
                    if (!leg.symbol || !quotes || !quotes[leg.symbol]) {
                        // console.warn(`Missing quote for ${leg.symbol}`);
                        dataMissing = true;
                    } else {
                        const quote = quotes[leg.symbol].quote;
                        const bid = quote.bidPrice || 0;
                        const ask = quote.askPrice || 0;
                        const last = quote.lastPrice || 0;
                        const close = quote.closePrice || 0;

                        // Market Open Logic: Use Mid Price
                        if (bid > 0 && ask > 0) {
                            mark = (bid + ask) / 2;
                        }
                        // Post-Market / Illiquid Logic: Use Last or Close
                        else if (last > 0) {
                            mark = last;
                        }
                        else {
                            mark = close;
                        }
                    }

                    if (leg.action === 'SELL') {
                        currentCostToClose += mark;
                    } else {
                        currentCostToClose -= mark;
                    }
                }

                // If data missing, we set cost to entry price => 0 PnL (Breakeven representation)
                // This ensures UI component renders "Live Performance" with 0 value instead of disappearing.
                if (dataMissing) {
                    currentCostToClose = alert.netCredit;
                }

                const unrealizedPnL = (alert.netCredit - currentCostToClose) * 100;
                const risk = alert.maxLoss * 100;
                const pnlPercent = risk > 0 ? (unrealizedPnL / risk) * 100 : 0;

                return {
                    ...alert,
                    performance: {
                        currentPrice: parseFloat(currentCostToClose.toFixed(2)),
                        unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
                        unrealizedPnLPercent: parseFloat(pnlPercent.toFixed(1)),
                        lastUpdated: new Date().toISOString()
                    }
                };
            });

        } catch (e) {
            console.error('Error in enrichAlertsWithPnL:', e);
            // Return original alerts on logic error
            return alerts;
        }
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
            (moveExhaustion * weights.moveExhaustion +
                expectedMoveUsage * weights.expectedMoveUsage +
                wallProximity * weights.wallProximity +
                timeRemaining * weights.timeRemaining +
                regimeStrength * weights.regimeStrength +
                driftAlignment * weights.driftAlignment) * 10
        );

        // 7. Charm Bonus (Bonus for favorable time decay pressure)
        const netCharm = gexContext.netCharm || 0;
        let charmBonus = 0;
        if (type === 'BULL_PUT' && netCharm > 1000) charmBonus = 5;
        else if (type === 'BEAR_CALL' && netCharm < -1000) charmBonus = 5;

        const finalScore = Math.min(100, qualityScore + charmBonus);

        // Determine quality level
        let qualityLevel: 'PREMIUM' | 'STANDARD' | 'AGGRESSIVE';
        if (finalScore >= 80) qualityLevel = 'PREMIUM';
        else if (finalScore >= 60) qualityLevel = 'STANDARD';
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
            qualityScore: finalScore,
            qualityLevel,
            riskLevel,
            qualityFactors,
            metadata
        };
    }

    /**
     * Generate trade alerts based on current market conditions
     */
    async generateAlerts(symbol: string = 'SPX', skipWindowCheck: boolean = false): Promise<TradeAlert[]> {
        try {
            // 1. Check if market is in valid trading window
            if (!skipWindowCheck) {
                const tradingWindow = this.getTradingWindow();
                if (!tradingWindow.isOpen) {
                    console.log(`⏰ Market closed. Window: ${tradingWindow.status}`);
                    return [];
                }
            }

            // 2. Get GEX metrics for context
            const gexMetrics = await this.gexService.calculateGEXMetrics(symbol);
            if (!gexMetrics || gexMetrics.currentPrice === 0) {
                console.warn('⚠️ No GEX metrics available for alert generation');
                return [];
            }

            // 3. Get options chain
            let searchSymbol = symbol.toUpperCase();
            let chain = await this.schwabService.getOptionsChain(searchSymbol);

            // Fallback for SPX to $SPX
            if ((!chain || (!chain.callExpDateMap && !chain.putExpDateMap)) && searchSymbol === 'SPX') {
                console.log('📡 TradeAlert: SPX Chain unavailable, trying $SPX...');
                chain = await this.schwabService.getOptionsChain('$SPX');
                if (chain) searchSymbol = '$SPX';
            }

            if (!chain) {
                console.warn(`⚠️ No options chain available for ${symbol}`);
                return [];
            }

            return this.generateAlertsFromData(symbol, gexMetrics, chain);
        } catch (error) {
            console.error('❌ Error in generateAlerts:', error);
            return [];
        }
    }

    /**
     * Generate alerts from raw data objects
     * Use this for backtesting
     */
    public async generateAlertsFromData(
        symbol: string,
        gexMetrics: GEXMetrics,
        chain: any,
        currentDay?: string
    ): Promise<TradeAlert[]> {
        try {
            // 4. Find today's/next expiration
            const targetExpiration = this.findTargetExpiration(chain, currentDay);
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

            const alerts = await this.processAlertGeneration(symbol, gexMetrics, options, targetExpiration, chain);

            // Save alerts to database for history
            await this.saveAlertsToDb(alerts);

            return alerts;
        } catch (error) {
            console.error('❌ Error in generateAlertsFromData:', error);
            return [];
        }
    }

    /**
     * Internal actual logic for signal generation
     */
    private async processAlertGeneration(
        symbol: string,
        gexMetrics: GEXMetrics,
        options: any[],
        targetExpiration: string,
        chain: any
    ): Promise<TradeAlert[]> {
        try {
            // 6. Generate alerts based on regime
            const alerts: TradeAlert[] = [];
            const { regime, netDrift, callWall, putWall, gammaFlip, currentPrice, totalGEX, netCharm } = gexMetrics;

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
                callWallStrength: gexMetrics.callWallStrength,
                putWallStrength: gexMetrics.putWallStrength,
                gammaFlip,
                currentPrice,
                netDrift,
                expectedMove,
                totalGEX,
                openPrice,
                netCharm,
                symbol
            };

            // --- Strategy Selection ---

            // 1. REVERSION A MUROS (Estrategia de Rebote Técnica)
            const wallProximityThreshold = currentPrice * 0.005;

            // Caso A: Rebote en Put Wall (Soporte Sólido)
            if (gexMetrics.putWallStrength === 'solid' && (currentPrice - putWall) < wallProximityThreshold && (currentPrice > putWall)) {
                const wallReversion = this.generateBullPutSpread(options, gexMetrics, targetExpiration, gexContext, 'wall');
                if (wallReversion) {
                    wallReversion.strategyLabel = 'Wall Reversion (Support)';
                    alerts.push(wallReversion);
                }
            }

            // Caso B: Rebote en Call Wall (Resistencia Sólida)
            if (gexMetrics.callWallStrength === 'solid' && (callWall - currentPrice) < wallProximityThreshold && (currentPrice < callWall)) {
                const wallReversion = this.generateBearCallSpread(options, gexMetrics, targetExpiration, gexContext, 'wall');
                if (wallReversion) {
                    wallReversion.strategyLabel = 'Wall Reversion (Resistance)';
                    alerts.push(wallReversion);
                }
            }

            // 2. ESTRATEGIAS BASADAS EN RÉGIMEN Y DERIVA
            if (alerts.length === 0 && regime !== 'volatile') {
                if (regime === 'stable' && Math.abs(netDrift) <= 0.5) {
                    const ironCondor = this.generateIronCondor(options, gexMetrics, targetExpiration, gexContext);
                    if (ironCondor) alerts.push(ironCondor);
                }

                if (netDrift > 0.5) {
                    const bullPut = this.generateBullPutSpread(options, gexMetrics, targetExpiration, gexContext, 'drift');
                    if (bullPut) alerts.push(bullPut);
                } else if (netDrift < -0.5) {
                    const bearCall = this.generateBearCallSpread(options, gexMetrics, targetExpiration, gexContext, 'drift');
                    if (bearCall) alerts.push(bearCall);
                }
            }

            // 3. VANNA CRUSH PLAYS (Solo en regímenes no volátiles)
            if (regime !== 'volatile') {
                if (gexMetrics.netVanna > 15000000) {
                    const vannaPlay = this.generateBullPutSpread(options, gexMetrics, targetExpiration, gexContext, 'vanna_crush');
                    if (vannaPlay && !alerts.find(a => a.id === vannaPlay.id)) alerts.push(vannaPlay);
                }
                if (gexMetrics.netVanna < -10000000) {
                    const vannaPlay = this.generateBearCallSpread(options, gexMetrics, targetExpiration, gexContext, 'vanna_crush');
                    if (vannaPlay && !alerts.find(a => a.id === vannaPlay.id)) alerts.push(vannaPlay);
                }
            }

            // Volatile regime warning
            if (regime === 'volatile') {
                alerts.push({
                    id: `warning-${Date.now()}`,
                    strategy: 'BEAR_CALL_SPREAD',
                    strategyLabel: '⚠️ Régimen Volátil Detectado',
                    underlying: symbol,
                    expiration: targetExpiration,
                    legs: [],
                    netCredit: 0,
                    maxLoss: 0,
                    maxProfit: 0,
                    probability: 0,
                    riskReward: 'N/A',
                    rationale: `El mercado está en régimen volátil con un Total GEX de ${(totalGEX / 1e6).toFixed(2)}M. Los dealers están en gamma negativa y amplificarán cualquier movimiento del precio. Se recomienda EVITAR la venta de premium hasta que el GEX regrese a niveles estables.`,
                    status: 'WATCH',
                    gexContext,
                    generatedAt: new Date().toISOString(),
                    validUntil: this.getValidUntil(),
                    qualityScore: 0,
                    qualityLevel: 'AGGRESSIVE',
                    riskLevel: 'HIGH',
                    qualityFactors: { moveExhaustion: 0, expectedMoveUsage: 0, wallProximity: 0, timeRemaining: 0, regimeStrength: 0, driftAlignment: 0 },
                    metadata: { openPrice: 0, moveFromOpen: 0, movePercent: 0, moveRatio: 0, wallDistance: 0, hoursRemaining: 0, generatedAtPrice: currentPrice }
                });
            }

            console.log(`✅ Generated ${alerts.length} trade alerts`);
            return alerts;
        } catch (error) {
            console.error('❌ Error in processAlertGeneration:', error);
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

            // Find short put candidates
            const shortPutCandidates = puts
                .filter(p => {
                    const strike = parseFloat(p.strikePrice || p.strike);
                    const delta = Math.abs(p.delta || 0);

                    // Si es por Wall Reversion, queremos vender MUY cerca del muro para máximo crédito
                    if (trigger === 'wall') {
                        return strike < currentPrice &&
                            strike >= putWall - 10 && strike <= putWall + 10 &&
                            delta >= 0.20 && delta <= 0.35; // Más agresivo cerca del muro
                    }

                    return strike < currentPrice &&
                        strike >= putWall - 20 &&
                        delta >= 0.15 && delta <= 0.25;
                })
                .sort((a, b) => trigger === 'wall' ? Math.abs(b.delta) - Math.abs(a.delta) : Math.abs(a.delta) - Math.abs(b.delta));

            if (shortPutCandidates.length === 0) return null;

            const shortPut = shortPutCandidates[0];
            const shortStrike = parseFloat(shortPut.strikePrice || shortPut.strike);
            const longStrike = shortStrike - this.SPREAD_WIDTH;

            // Generate unique deterministic ID with timestamp to allow multiple signals in backtest
            const alertId = `BPS-${expiration}-${shortStrike}-${trigger || 'drift'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`.replace(/:/g, '-');

            // Find long put
            const longPut = puts.find(p => {
                const strike = parseFloat(p.strikePrice || p.strike);
                return Math.abs(strike - longStrike) < 1;
            });

            if (!longPut) return null;

            const shortPrice = (shortPut.bid + shortPut.ask) / 2 || shortPut.last || 0;
            const longPrice = (longPut.bid + longPut.ask) / 2 || longPut.last || 0;
            const netCredit = shortPrice - longPrice;

            if (netCredit <= 0.20) return null;

            const maxLoss = this.SPREAD_WIDTH - netCredit;
            const probability = 1 - Math.abs(shortPut.delta || 0.25);

            // Determine status based on expected move
            let status: 'ACTIVE' | 'WATCH' = 'ACTIVE';
            if (expectedMove && shortStrike >= lowerBound && trigger !== 'wall') {
                status = 'WATCH';
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
            const stopPrice = trigger === 'wall' ? putWall - 5 : (expectedMove ? Math.max(lowerBound, shortStrike + 5) : shortStrike + 5);
            const exitCriteria = {
                profitTarget: "100% (Dejar Expirar)",
                stopLoss: trigger === 'wall'
                    ? `Cerrar inmediatamente si el Put Wall ($${putWall}) se rompe (Precio < ${stopPrice.toFixed(0)})`
                    : `Cerrar si ${gexContext.symbol || 'SPX'} baja de ${stopPrice.toFixed(0)}`,
                timeExit: `Cerrar a las 3:45 PM si está en riesgo`
            };

            return {
                id: alertId,
                strategy: 'BULL_PUT_SPREAD',
                strategyLabel: trigger === 'wall' ? 'Wall Reversion (Support)' : 'Bull Put Spread',
                underlying: gexContext.symbol || 'SPX',
                expiration,
                legs: [
                    { action: 'SELL', type: 'PUT', strike: shortStrike, price: shortPrice, delta: shortPut.delta || 0 },
                    { action: 'BUY', type: 'PUT', strike: longStrike, price: longPrice, delta: longPut.delta || 0 }
                ],
                netCredit: parseFloat(netCredit.toFixed(2)),
                maxLoss: parseFloat(maxLoss.toFixed(2)),
                maxProfit: parseFloat(netCredit.toFixed(2)),
                probability: parseFloat((probability * 100).toFixed(1)),
                riskReward: `1:${(maxLoss / netCredit).toFixed(1)}`,
                rationale: trigger === 'wall'
                    ? `ESTRATEGIA REVERSION: El precio está testeando un Put Wall SÓLIDO en $${putWall.toFixed(0)}. El crédito es ALTO debido a la cercanía del muro. El riesgo es que si el muro se rompe, el soporte desaparece, por lo que el Stop Loss es estricto justo debajo del muro.`
                    : trigger === 'vanna_crush'
                        ? `ESTRATEGIA VANNA CRUSH: El Net Vanna es positivo (${(gexMetrics.netVanna / 1e6).toFixed(1)}M). Un colapso de IV forzará compras de Dealers.`
                        : `El Put Wall en $${putWall.toFixed(0)} actúa como soporte clave. Se vende premium aprovechando la defensa institucional en este nivel.`,
                status,
                gexContext,
                generatedAt: new Date().toISOString(),
                validUntil: this.getValidUntil(),
                qualityScore: trigger === 'wall' ? Math.max(quality.qualityScore, 75) : quality.qualityScore, // Boost score for technical wall plays
                qualityLevel: quality.qualityLevel,
                riskLevel: trigger === 'wall' ? 'MEDIUM' : quality.riskLevel,
                qualityFactors: quality.qualityFactors,
                metadata: quality.metadata,
                exitCriteria
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

            // Find short call candidates
            const shortCallCandidates = calls
                .filter(c => {
                    const strike = parseFloat(c.strikePrice || c.strike);
                    const delta = Math.abs(c.delta || 0);

                    if (trigger === 'wall') {
                        return strike > currentPrice &&
                            strike >= callWall - 10 && strike <= callWall + 10 &&
                            delta >= 0.20 && delta <= 0.35;
                    }

                    return strike > currentPrice &&
                        strike <= callWall + 20 &&
                        delta >= 0.15 && delta <= 0.25;
                })
                .sort((a, b) => trigger === 'wall' ? Math.abs(b.delta) - Math.abs(a.delta) : Math.abs(a.delta) - Math.abs(b.delta));

            if (shortCallCandidates.length === 0) return null;

            const shortCall = shortCallCandidates[0];
            const shortStrike = parseFloat(shortCall.strikePrice || shortCall.strike);
            const longStrike = shortStrike + this.SPREAD_WIDTH;

            // Generate unique deterministic ID with timestamp to allow multiple signals in backtest
            const alertId = `BCS-${expiration}-${shortStrike}-${trigger || 'drift'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`.replace(/:/g, '-');

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
            if (expectedMove && shortStrike <= upperBound && trigger !== 'wall') {
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
            const stopPrice = trigger === 'wall' ? callWall + 5 : (expectedMove ? Math.min(upperBound, shortStrike - 5) : shortStrike - 5);
            const exitCriteria = {
                profitTarget: "100% (Dejar Expirar)",
                stopLoss: trigger === 'wall'
                    ? `Cerrar inmediatamente si el Call Wall ($${callWall}) se rompe (Precio > ${stopPrice.toFixed(0)})`
                    : `Cerrar si ${gexContext.symbol || 'SPX'} sube de ${stopPrice.toFixed(0)}`,
                timeExit: `Cerrar a las 3:45 PM si está en riesgo`
            };

            return {
                id: alertId,
                strategy: 'BEAR_CALL_SPREAD',
                strategyLabel: trigger === 'wall' ? 'Wall Reversion (Resistance)' : 'Bear Call Spread',
                underlying: gexContext.symbol || 'SPX',
                expiration,
                legs: [
                    { action: 'SELL', type: 'CALL', strike: shortStrike, price: shortPrice, delta: shortCall.delta || 0 },
                    { action: 'BUY', type: 'CALL', strike: longStrike, price: longPrice, delta: longCall.delta || 0 }
                ],
                netCredit: parseFloat(netCredit.toFixed(2)),
                maxLoss: parseFloat(maxLoss.toFixed(2)),
                maxProfit: parseFloat(netCredit.toFixed(2)),
                probability: parseFloat((probability * 100).toFixed(1)),
                riskReward: `1:${(maxLoss / netCredit).toFixed(1)}`,
                rationale: trigger === 'wall'
                    ? `ESTRATEGIA REVERSION: El precio se acerca al Call Wall SÓLIDO en $${callWall.toFixed(0)}. Aprovechamos el crédito ALTO por la proximidad técnica. El riesgo es un breakout del muro, por lo que el Stop Loss se sitúa justo por encima de este nivel de liquidez.`
                    : trigger === 'vanna_crush'
                        ? `ESTRATEGIA VANNA CRUSH: El Net Vanna es negativo (${(gexMetrics.netVanna / 1e6).toFixed(1)}M). Un colapso de IV causará ventas de Dealers.`
                        : `El Call Wall en $${callWall.toFixed(0)} es la resistencia estadística clave. Se vende premium confiando en la defensa mecánica de este nivel institucional.`,
                status,
                gexContext,
                generatedAt: new Date().toISOString(),
                validUntil: this.getValidUntil(),
                qualityScore: trigger === 'wall' ? Math.max(quality.qualityScore, 75) : quality.qualityScore,
                qualityLevel: quality.qualityLevel,
                riskLevel: trigger === 'wall' ? 'MEDIUM' : quality.riskLevel,
                qualityFactors: quality.qualityFactors,
                metadata: quality.metadata,
                exitCriteria
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

            // Generate unique deterministic ID which includes timestamp
            const alertId = `IC-${expiration}-${bullPut.legs[0].strike}-${bearCall.legs[0].strike}-${Date.now()}-${Math.floor(Math.random() * 1000)}`.replace(/:/g, '-');

            // Combined probability (both sides need to work)
            const probability = Math.min(bullPut.probability, bearCall.probability);

            return {
                id: alertId,
                strategy: 'IRON_CONDOR',
                strategyLabel: 'Iron Condor',
                underlying: gexContext.symbol || 'SPX',
                expiration,
                legs: combinedLegs,
                netCredit: parseFloat(totalCredit.toFixed(2)),
                maxLoss: parseFloat(maxLoss.toFixed(2)),
                maxProfit: parseFloat(totalCredit.toFixed(2)),
                probability: parseFloat(probability.toFixed(1)),
                riskReward: `1:${(maxLoss / totalCredit).toFixed(1)}`,
                rationale: `Ideal para captura de Theta en un régimen ${gexContext.regime === 'stable' ? `estable con un Total GEX de ${(gexContext.totalGEX / 1e6).toFixed(1)}M (Gamma Positiva)` : 'neutral'}. El precio se proyecta contenido dentro del rango de Muros ($${gexContext.putWall.toFixed(0)} - $${gexContext.callWall.toFixed(0)}). Con un Net Drift de ${gexContext.netDrift.toFixed(2)}, esta estrategia aprovecha la compresión de volatilidad implícita y la defensa mecánica de los Market Makers en ambos extremos del rango esperado.`,
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
    private findTargetExpiration(chain: any, currentDayOverride?: string): string | null {
        const today = currentDayOverride || new Date().toLocaleDateString('en-CA');
        const allDates = new Set<string>();

        if (chain.callExpDateMap) {
            Object.keys(chain.callExpDateMap).forEach(date => allDates.add(date.split(':')[0]));
        }
        if (chain.putExpDateMap) {
            Object.keys(chain.putExpDateMap).forEach(date => allDates.add(date.split(':')[0]));
        }

        // Support for flattened chain format (for backtesting)
        if (chain.calls && Array.isArray(chain.calls)) {
            chain.calls.forEach((c: any) => {
                if (c.expirationDate) allDates.add(c.expirationDate.split('T')[0]);
            });
        }
        if (chain.puts && Array.isArray(chain.puts)) {
            chain.puts.forEach((p: any) => {
                if (p.expirationDate) allDates.add(p.expirationDate.split('T')[0]);
            });
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

        // Handle nested map format
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

        // Handle flattened array format
        if (chain.calls && Array.isArray(chain.calls)) {
            options.push(...chain.calls.filter((c: any) => c.expirationDate?.startsWith(expiration)));
        }
        if (chain.puts && Array.isArray(chain.puts)) {
            options.push(...chain.puts.filter((p: any) => p.expirationDate?.startsWith(expiration)));
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

    async updateAlertResult(id: string, result: 'WIN' | 'LOSS', realizedPnl: number, closedAtPrice: number): Promise<boolean> {
        try {
            const db = getDb();
            const status = result === 'WIN' ? 'EXPIRED' : 'CANCELLED'; // Mapping outcome to status

            const query = `
                UPDATE trade_alerts 
                SET result = ?, realized_pnl = ?, closed_at_price = ?, status = ?
                WHERE id = ?
            `;

            const res = await db.run(query, [result, realizedPnl, closedAtPrice, status, id]);

            if (res && (res.changes > 0 || res.lastID)) {
                console.log(`✅ Alert ${id} updated with result: ${result} ($${realizedPnl})`);
                return true;
            }

            console.warn(`⚠️ Alert ${id} not found for update`);
            return false;
        } catch (error) {
            console.error(`❌ Failed to update result for alert ${id}:`, error);
            return false;
        }
    }
}
