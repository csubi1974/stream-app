import { SchwabService } from './schwabService.js';
import { GEXService, GEXMetrics } from './gexService.js';

export interface TradeLeg {
    action: 'BUY' | 'SELL';
    type: 'CALL' | 'PUT';
    strike: number;
    price: number;
    delta: number;
    symbol?: string;
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
            const { regime, netDrift, callWall, putWall, gammaFlip, currentPrice } = gexMetrics;

            // Calculate expected move
            const expectedMove = this.calculateExpectedMove(options, currentPrice);

            console.log(`📊 Generating alerts for ${symbol} | Regime: ${regime} | Drift: ${netDrift.toFixed(2)} | Expected Move: ±${expectedMove.toFixed(2)}`);

            // Context for all alerts
            const gexContext = {
                regime,
                callWall,
                putWall,
                gammaFlip,
                currentPrice,
                netDrift,
                expectedMove
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

            // Neutral drift but stable: Also suggest spreads near walls
            if (Math.abs(netDrift) <= 0.5 && regime === 'stable') {
                const bullPut = this.generateBullPutSpread(options, gexMetrics, targetExpiration, gexContext);
                if (bullPut) alerts.push(bullPut);

                const bearCall = this.generateBearCallSpread(options, gexMetrics, targetExpiration, gexContext);
                if (bearCall) alerts.push(bearCall);
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
        gexContext: any
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

            return {
                id: `bps-${Date.now()}`,
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
                rationale: `Put Wall en $${putWall.toFixed(0)} actúa como soporte. Strike vendido en $${shortStrike.toFixed(0)} está ${expectedMove ? (shortStrike < lowerBound ? `FUERA del rango esperado (±$${expectedMove.toFixed(1)}) ✅` : `DENTRO del rango esperado (±$${expectedMove.toFixed(1)}) ⚠️`) : 'en zona de alta probabilidad'}. Régimen ${gexContext.regime}.`,
                status,
                gexContext,
                generatedAt: new Date().toISOString(),
                validUntil: this.getValidUntil()
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
        gexContext: any
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

            return {
                id: `bcs-${Date.now()}`,
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
                rationale: `Call Wall en $${callWall.toFixed(0)} actúa como resistencia. Strike vendido en $${shortStrike.toFixed(0)} está ${expectedMove ? (shortStrike > upperBound ? `FUERA del rango esperado (±$${expectedMove.toFixed(1)}) ✅` : `DENTRO del rango esperado (±$${expectedMove.toFixed(1)}) ⚠️`) : 'en zona de alta probabilidad'}. Dealers cortos en gamma.`,
                status,
                gexContext,
                generatedAt: new Date().toISOString(),
                validUntil: this.getValidUntil()
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

            // Combined probability (both sides need to work)
            const probability = Math.min(bullPut.probability, bearCall.probability);

            return {
                id: `ic-${Date.now()}`,
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
                rationale: `Régimen estable con precio entre muros ($${gexContext.putWall.toFixed(0)} - $${gexContext.callWall.toFixed(0)}). Ideal para venta de volatilidad.`,
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
}
