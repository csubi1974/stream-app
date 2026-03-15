// ─────────────────────────────────────────────────────────
// Indicator Engine — Pure calculation functions
// ─────────────────────────────────────────────────────────

export interface OHLCBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface IndicatorPoint {
    time: number;
    value: number;
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(data: OHLCBar[], period: number = 14): number {
    if (!data || data.length < period + 1) return 0;
    let trSum = 0;
    for (let i = data.length - period; i < data.length; i++) {
        const h = data[i].high;
        const l = data[i].low;
        const pc = data[i-1].close;
        const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        trSum += tr;
    }
    return trSum / period;
}

/**
 * Simple Moving Average (SMA)
 * Returns N - period + 1 data points, each being the average of the last `period` closes.
 */
export function calculateSMA(data: OHLCBar[], period: number): IndicatorPoint[] {
    if (!data || data.length < period) return [];
    
    const result: IndicatorPoint[] = [];
    let sum = 0;
    
    for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= period) {
            sum -= data[i - period].close;
        }
        if (i >= period - 1) {
            result.push({
                time: data[i].time,
                value: parseFloat((sum / period).toFixed(4)),
            });
        }
    }
    
    return result;
}

/**
 * Relative Strength Index (RSI) — Wilder's Smoothing
 * Standard 0-100 oscillator. Overbought > 70, Oversold < 30.
 */
export function calculateRSI(data: OHLCBar[], period: number = 14): IndicatorPoint[] {
    if (!data || data.length < period + 1) return [];

    const result: IndicatorPoint[] = [];
    const changes: number[] = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
        changes.push(data[i].close - data[i - 1].close);
    }

    // Initial average gain/loss (simple average of first `period` changes)
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < period; i++) {
        if (changes[i] >= 0) {
            avgGain += changes[i];
        } else {
            avgLoss += Math.abs(changes[i]);
        }
    }

    avgGain /= period;
    avgLoss /= period;

    // First RSI point
    const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const firstRSI = avgLoss === 0 ? 100 : 100 - (100 / (1 + firstRS));
    result.push({
        time: data[period].time,
        value: parseFloat(firstRSI.toFixed(2)),
    });

    // Subsequent points — Wilder's smoothing
    for (let i = period; i < changes.length; i++) {
        const change = changes[i];
        const gain = change >= 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

        result.push({
            time: data[i + 1].time,
            value: parseFloat(rsi.toFixed(2)),
        });
    }

    return result;
}

/**
 * Incrementally update the last SMA value when a new candle arrives.
 * `existingData` should be the full OHLC dataset INCLUDING the newly updated bar.
 * Returns the updated last point only (for chart.update() calls).
 */
export function updateLastSMA(data: OHLCBar[], period: number): IndicatorPoint | null {
    if (!data || data.length < period) return null;
    
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, bar) => acc + bar.close, 0);
    
    return {
        time: data[data.length - 1].time,
        value: parseFloat((sum / period).toFixed(4)),
    };
}

/**
 * Recalculate the last RSI value from full dataset.
 * Needed on each live update since RSI uses cumulative smoothing.
 */
export function updateLastRSI(data: OHLCBar[], period: number = 14): IndicatorPoint | null {
    if (!data || data.length < period + 2) return null;
    
    // For RSI we need to recalculate from scratch due to Wilder's smoothing dependency chain
    const rsiData = calculateRSI(data, period);
    return rsiData.length > 0 ? rsiData[rsiData.length - 1] : null;
}

// ─────────────────────────────────────────────────────────
// Statistical Mean Reversion Engine (Rolling Backtest)
// ─────────────────────────────────────────────────────────

export interface ReversionSignal {
    time: number;
    price: number;
    type: 'buy' | 'sell';
    probability: number;
    distance: number;
    zScore: number;
    outcome: 'WIN' | 'LOSS' | 'PENDING';
}

export interface SignalStats {
    wins: number;
    losses: number;
    pending: number;
    winRate: number;
}

export function calculateReversionSignals(
    data: OHLCBar[],
    smaPeriod: number = 8,
    zThreshold: number = 2.0, // Used as a baseline filter
    topStrike: number | null = null
): { signals: ReversionSignal[], winRate: number, totalEvents: number } {
    if (!data || data.length < smaPeriod + 20) {
        return { signals: [], winRate: 0, totalEvents: 0 };
    }

    const stats: { dist: number; sma: number; absDist: number }[] = new Array(data.length).fill(null);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= smaPeriod) sum -= data[i - smaPeriod].close;
        if (i >= smaPeriod - 1) {
            const sma = sum / smaPeriod;
            const dist = (data[i].close - sma) / sma;
            stats[i] = { dist, sma, absDist: Math.abs(dist) };
        }
    }

    // 1. Dynamic Optimization: Find the "Sweet Spot" distance %
    // We scan a wider range to accommodate for different timeframes (1m vs 1h vs 1d)
    const testThresholds: number[] = [];
    for (let t = 0.003; t <= 0.05; t += 0.002) testThresholds.push(t);

    let bestThreshold = 0.01;
    let maxWinRate = 0;

    testThresholds.forEach(thresh => {
        let hits = 0;
        let wins = 0;
        for (let i = smaPeriod; i < data.length - 15; i++) {
            if (stats[i] && stats[i].absDist >= thresh) {
                // Peek ahead to see if this is the "local extreme" (to avoid triggering too early in a move)
                const isLocalPeak = !stats[i+1] || stats[i+1].absDist < stats[i].absDist;
                if (!isLocalPeak) continue;

                hits++;
                const isBuy = stats[i].dist < 0;
                let won = false;
                for (let f = i + 1; f < i + 15; f++) {
                    if (isBuy && data[f].high >= stats[f]?.sma) { won = true; break; }
                    if (!isBuy && data[f].low <= stats[f]?.sma) { won = true; break; }
                }
                if (won) wins++;
                i += 5; 
            }
        }
        const wr = hits > 0 ? (wins / hits) * (1 + Math.log10(hits)) : 0; // Weigh WR by sample size
        if (wr > maxWinRate && hits >= 2) {
            maxWinRate = wr;
            bestThreshold = thresh;
        }
    });

    // 2. Generate Signals using the Optimal Threshold + Peak Logic
    let successes = 0;
    let events = 0;
    const signals: ReversionSignal[] = [];

    for (let i = smaPeriod; i < data.length; i++) {
        const bar = data[i];
        const stat = stats[i];
        if (!stat) continue;

        let triggered = false;
        let isBuy = false;

        // Condition 1: Hit the optimized bestThreshold
        // Condition 2: Is it a "turning point" or significantly over-extended?
        const isExtreme = stat.absDist >= bestThreshold;
        const isTurning = i === data.length - 1 || stats[i+1].absDist < stat.absDist;

        if (isExtreme && isTurning && (!topStrike || (stat.dist < 0 ? bar.close < topStrike : bar.close > topStrike))) {
            triggered = true;
            isBuy = stat.dist < 0;
        }

        if (triggered) {
            events++;
            const atrAtSignal = calculateATR(data.slice(0, i + 1), 14);
            const volatilityTarget = atrAtSignal * 1.0; // Reduced from 1.5 for better sensitivity
            let hitVolatilityTarget = false;
            let touchedSMA = false;
            let extendedFurther = false;
            const maxLookForward = Math.min(i + 15, data.length);
            const isLastCandles = i >= data.length - 3; // Last 3 candles = PENDING

            for (let f = i + 1; f < maxLookForward; f++) {
                const currentSMA = stats[f]?.sma;
                if (!currentSMA) continue;

                // Condition 1: Volatility Target (Quick Profit)
                if (isBuy && data[f].high >= bar.close + volatilityTarget) {
                    hitVolatilityTarget = true;
                    break;
                }
                if (!isBuy && data[f].low <= bar.close - volatilityTarget) {
                    hitVolatilityTarget = true;
                    break;
                }

                // Condition 2: SMA Touch
                if (isBuy) {
                    if (data[f].high >= currentSMA) {
                        if (currentSMA > bar.close) touchedSMA = true;
                        else extendedFurther = true;
                        break; 
                    }
                } else {
                    if (data[f].low <= currentSMA) {
                        if (currentSMA < bar.close) touchedSMA = true;
                        else extendedFurther = true;
                        break;
                    }
                }

                if (stats[f]) {
                    const newDist = Math.abs(stats[f].dist);
                    // More breathing room: only invalidate if it doubles the distance (2.0)
                    if (newDist > stat.absDist * 2.0) { extendedFurther = true; break; }
                }
            }

            if (touchedSMA || hitVolatilityTarget) successes++;

            // Determine outcome
            let outcome: 'WIN' | 'LOSS' | 'PENDING' = 'PENDING';
            if (isLastCandles) {
                outcome = 'PENDING';
            } else if (touchedSMA || hitVolatilityTarget) {
                outcome = 'WIN';
            } else {
                outcome = 'LOSS';
            }

            signals.push({
                time: bar.time,
                price: isBuy ? Math.min(bar.low, bar.close) : Math.max(bar.high, bar.close),
                type: isBuy ? 'buy' : 'sell',
                probability: 0,
                distance: parseFloat((stat.dist * 100).toFixed(2)),
                zScore: 0,
                outcome
            });
            
            i += 2; 
        }
    }

    const finalWinRate = events > 0 ? (successes / events) * 100 : 75.0;
    signals.forEach(s => { if (s.probability === 0) s.probability = parseFloat(finalWinRate.toFixed(1)); });

    return { signals, winRate: parseFloat(finalWinRate.toFixed(1)), totalEvents: events };
}

// ─────────────────────────────────────────────────────────
// Trend Pullback Signal Engine (Pro-Trend Incorporation)
// ─────────────────────────────────────────────────────────

export interface TrendSignal {
    time: number;
    price: number;
    type: 'trend_long' | 'trend_short';
    level: number;        // The S/R level that triggered the signal
    levelType: string;    // 'GEX_PUT_WALL' | 'GEX_GFLIP' | 'BOUNCE_ZONE' | 'GEX+BOUNCE'
    confidence: number;   // 0-100 based on confluences
    outcome: 'WIN' | 'LOSS' | 'PENDING';
}

export interface MacroBias {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    dexBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    breadthBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    gexBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confluences: number; // How many sources agree (0-3)
}

export interface GEXLevels {
    callWall: number;
    putWall: number;
    gammaFlip: number;
    topStrike?: number;
    currentPrice?: number;
    netDex?: number;       // Net Delta Exposure from 0DTE scanner
    vannaExposure?: number;
}

export interface BreadthData {
    gainers: number;
    losers: number;
    buyPressure: number; // 0-100
}

/**
 * Determine the macro trend bias from multiple independent sources.
 * Requires at least 2 of 3 sources to agree for a directional bias.
 */
export function determineMacroBias(
    gexLevels: GEXLevels | null,
    breadth: BreadthData | null
): MacroBias {
    let dexBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let breadthBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let gexBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    // 1. DEX Analysis: Net Delta Exposure direction
    if (gexLevels?.netDex != null) {
        if (gexLevels.netDex > 0) dexBias = 'BULLISH';
        else if (gexLevels.netDex < 0) dexBias = 'BEARISH';
    } else if (gexLevels?.vannaExposure != null) {
        // Fallback: use vanna exposure
        if (gexLevels.vannaExposure > 0) dexBias = 'BULLISH';
        else if (gexLevels.vannaExposure < 0) dexBias = 'BEARISH';
    }

    // 2. Breadth Analysis: Gainers vs Losers + Money Flow
    if (breadth) {
        const total = breadth.gainers + breadth.losers;
        if (total > 0) {
            const ratio = breadth.gainers / total;
            if (ratio >= 0.6 && breadth.buyPressure >= 55) breadthBias = 'BULLISH';
            else if (ratio <= 0.4 && breadth.buyPressure <= 45) breadthBias = 'BEARISH';
        }
    }

    // 3. GEX Regime: Price position relative to Gamma Flip with Buffer (Dead Zone)
    // We use a 0.25% buffer (approx. 15-18 points on SPX) to prevent flickering
    // as the Flip level moves during the day.
    if (gexLevels?.gammaFlip && gexLevels?.currentPrice) {
        const distFromFlip = (gexLevels.currentPrice - gexLevels.gammaFlip) / gexLevels.gammaFlip;
        const buffer = 0.0025; // 0.25% Buffer Zone
        
        if (distFromFlip > buffer) {
            gexBias = 'BULLISH';   // Clearly Above → Stable
        } else if (distFromFlip < -buffer) {
            gexBias = 'BEARISH';  // Clearly Below → Unstable
        } else {
            gexBias = 'NEUTRAL';  // Inside the "Dead Zone" or Flip Zone
        }
    }

    // Count confluences
    const biases = [dexBias, breadthBias, gexBias];
    const bullCount = biases.filter(b => b === 'BULLISH').length;
    const bearCount = biases.filter(b => b === 'BEARISH').length;

    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confluences = 0;

    if (bullCount >= 2) { direction = 'BULLISH'; confluences = bullCount; }
    else if (bearCount >= 2) { direction = 'BEARISH'; confluences = bearCount; }
    else { confluences = Math.max(bullCount, bearCount); }

    return { direction, dexBias, breadthBias, gexBias, confluences };
}

/**
 * Detect dynamic Support/Resistance zones from price action.
 * Finds swing highs/lows and groups nearby levels into zones.
 */
function detectSwingZones(data: OHLCBar[], lookback: number = 100): { supports: number[], resistances: number[] } {
    const supports: number[] = [];
    const resistances: number[] = [];
    const start = Math.max(0, data.length - lookback);

    for (let i = start + 2; i < data.length - 2; i++) {
        const bar = data[i];
        // Swing Low: low is lower than 2 bars before and 2 bars after
        if (bar.low <= data[i-1].low && bar.low <= data[i-2].low &&
            bar.low <= data[i+1].low && bar.low <= data[i+2].low) {
            supports.push(bar.low);
        }
        // Swing High: high is higher than 2 bars before and 2 bars after
        if (bar.high >= data[i-1].high && bar.high >= data[i-2].high &&
            bar.high >= data[i+1].high && bar.high >= data[i+2].high) {
            resistances.push(bar.high);
        }
    }

    // Cluster nearby levels (within 0.15% of each other)
    const clusterLevels = (levels: number[], threshold: number): number[] => {
        if (levels.length === 0) return [];
        const sorted = [...levels].sort((a, b) => a - b);
        const clusters: { sum: number; count: number }[] = [];
        let current = { sum: sorted[0], count: 1 };

        for (let i = 1; i < sorted.length; i++) {
            const avg = current.sum / current.count;
            if (Math.abs(sorted[i] - avg) / avg <= threshold) {
                current.sum += sorted[i];
                current.count++;
            } else {
                clusters.push(current);
                current = { sum: sorted[i], count: 1 };
            }
        }
        clusters.push(current);

        // Only return zones with 2+ touches (proven zones)
        return clusters
            .filter(c => c.count >= 2)
            .map(c => parseFloat((c.sum / c.count).toFixed(2)));
    };

    return {
        supports: clusterLevels(supports, 0.0015),
        resistances: clusterLevels(resistances, 0.0015)
    };
}

/**
 * Check if a candle shows rejection at a given level.
 * For bullish rejection (at support): the bar dips to/below the level but closes above it.
 * For bearish rejection (at resistance): the bar rises to/above the level but closes below it.
 */
function hasCandleRejection(bar: OHLCBar, level: number, direction: 'BULLISH' | 'BEARISH', tolerance: number): boolean {
    if (direction === 'BULLISH') {
        // Price dipped to or near the support level, but closed back above
        const touched = bar.low <= level + tolerance;
        const closedAbove = bar.close > level;
        const hasLowerWick = (bar.close - bar.low) > (bar.high - bar.close) * 0.6;
        return touched && closedAbove && hasLowerWick;
    } else {
        // Price rose to or near the resistance level, but closed back below
        const touched = bar.high >= level - tolerance;
        const closedBelow = bar.close < level;
        const hasUpperWick = (bar.high - bar.close) > (bar.close - bar.low) * 0.6;
        return touched && closedBelow && hasUpperWick;
    }
}

/**
 * Main Trend Pullback Signal Calculator.
 * Generates high-probability signals when price pulls back to proven S/R
 * during a confirmed macro trend.
 */
export function calculateTrendPullbackSignals(
    data: OHLCBar[],
    bias: MacroBias,
    gexLevels: GEXLevels | null
): { signals: TrendSignal[], activeLevels: { price: number; type: string; touches: number }[] } {
    const signals: TrendSignal[] = [];
    const activeLevels: { price: number; type: string; touches: number }[] = [];

    if (!data || data.length < 30 || bias.direction === 'NEUTRAL' || !gexLevels) {
        return { signals, activeLevels };
    }

    const currentPrice = gexLevels.currentPrice || data[data.length - 1].close;
    const tolerance = currentPrice * 0.0015; // 0.15% proximity to count as "touching"

    // 1. Collect all candidate levels
    const candidateLevels: { price: number; type: string; score: number }[] = [];

    // GEX Levels (highest priority)
    if (gexLevels.putWall && gexLevels.putWall > 0) {
        candidateLevels.push({ price: gexLevels.putWall, type: 'PUT_WALL', score: 3 });
    }
    if (gexLevels.callWall && gexLevels.callWall > 0) {
        candidateLevels.push({ price: gexLevels.callWall, type: 'CALL_WALL', score: 3 });
    }
    if (gexLevels.gammaFlip && gexLevels.gammaFlip > 0) {
        candidateLevels.push({ price: gexLevels.gammaFlip, type: 'GAMMA_FLIP', score: 3 });
    }
    if (gexLevels.topStrike && gexLevels.topStrike > 0) {
        candidateLevels.push({ price: gexLevels.topStrike, type: 'TOP_GEX', score: 2 });
    }

    // 2. Detect Price Action bounce zones
    const { supports, resistances } = detectSwingZones(data);

    supports.forEach(s => {
        // Check if this bounce zone aligns with a GEX level
        const gexMatch = candidateLevels.find(g => Math.abs(g.price - s) / s <= 0.003);
        if (gexMatch) {
            // CONFLUENCE: GEX + Bounce Zone → highest confidence
            gexMatch.type = `${gexMatch.type}+BOUNCE`;
            gexMatch.score = 5;
        } else {
            candidateLevels.push({ price: s, type: 'BOUNCE_SUPPORT', score: 2 });
        }
    });

    resistances.forEach(r => {
        const gexMatch = candidateLevels.find(g => Math.abs(g.price - r) / r <= 0.003);
        if (gexMatch) {
            gexMatch.type = `${gexMatch.type}+BOUNCE`;
            gexMatch.score = 5;
        } else {
            candidateLevels.push({ price: r, type: 'BOUNCE_RESIST', score: 2 });
        }
    });

    // 3. Filter levels relevant to the current bias
    let relevantLevels = candidateLevels;
    if (bias.direction === 'BULLISH') {
        // For bullish trend: look for SUPPORT levels below price for pullback entries
        relevantLevels = candidateLevels.filter(l => l.price < currentPrice && l.price > currentPrice * 0.95);
    } else {
        // For bearish trend: look for RESISTANCE levels above price for pullback entries
        relevantLevels = candidateLevels.filter(l => l.price > currentPrice && l.price < currentPrice * 1.05);
    }

    // Sort by score (highest confidence first)
    relevantLevels.sort((a, b) => b.score - a.score);

    // Populate activeLevels for visualization
    relevantLevels.forEach(l => {
        activeLevels.push({ price: l.price, type: l.type, touches: l.score });
    });

    // 4. Scan price data for pullback rejections at relevant levels
    const minIndex = Math.max(10, data.length - 200); // Scan recent history
    for (let i = minIndex; i < data.length; i++) {
        const bar = data[i];

        for (const level of relevantLevels) {
            const rejected = hasCandleRejection(bar, level.price, bias.direction, tolerance);
            if (!rejected) continue;

            // Calculate confidence based on: macro confluences + level type score
            let confidence = 40 + (bias.confluences * 15) + (level.score * 5);
            confidence = Math.min(95, Math.max(50, confidence));

            // Determine label (Abbreviated for space)
            let levelLabel = level.type;
            if (level.type.includes('+BOUNCE')) levelLabel = 'G+B';
            else if (level.type.includes('PUT_WALL')) levelLabel = 'P.W';
            else if (level.type.includes('CALL_WALL')) levelLabel = 'C.W';
            else if (level.type.includes('GAMMA_FLIP')) levelLabel = 'G.F';
            else if (level.type.includes('TOP_GEX')) levelLabel = 'T.G';
            else if (level.type.includes('BOUNCE')) levelLabel = 'S/R';

            // Determine outcome: did it bounce and continue trend?
            let outcome: 'WIN' | 'LOSS' | 'PENDING' = 'PENDING';
            const isRecent = i >= data.length - 10; // More caution with recent signals
            if (!isRecent) {
                const atr = calculateATR(data.slice(0, i + 1), 14);
                const targetMove = Math.max(currentPrice * 0.002, atr * 1.5); // Use ATR for dynamic target
                let hitTarget = false;
                let levelBroken = false;
                const lookMax = Math.min(i + 25, data.length); // Allow more time (25 bars) for setup to play out
                
                for (let f = i + 1; f < lookMax; f++) {
                    if (bias.direction === 'BULLISH') {
                        if (data[f].high >= bar.close + targetMove) { hitTarget = true; break; }
                        // Strict invalidation: close below level
                        if (data[f].close < level.price - tolerance) { levelBroken = true; break; }
                    } else {
                        if (data[f].low <= bar.close - targetMove) { hitTarget = true; break; }
                        if (data[f].close > level.price + tolerance) { levelBroken = true; break; }
                    }
                }
                
                if (hitTarget) outcome = 'WIN';
                else if (levelBroken || (i + 25 < data.length && !hitTarget)) outcome = 'LOSS';
            }

            // Only include High Quality signals (Rigor filter)
            if (confidence >= 75) {
                signals.push({
                    time: bar.time,
                    price: bias.direction === 'BULLISH' ? bar.low : bar.high,
                    type: bias.direction === 'BULLISH' ? 'trend_long' : 'trend_short',
                    level: level.price,
                    levelType: levelLabel,
                    confidence,
                    outcome
                });
            }

            break; // One signal per bar max
        }
    }

    // Deduplicate: max 1 signal per 15 bars (Extreme Rigor filter)
    const filtered: TrendSignal[] = [];
    let lastSignalIdx = -30;
    for (let i = 0; i < signals.length; i++) {
        const barIdx = data.findIndex(d => d.time === signals[i].time);
        if (barIdx - lastSignalIdx >= 15) {
            filtered.push(signals[i]);
            lastSignalIdx = barIdx;
        }
    }

    return { signals: filtered, activeLevels };
}

/**
 * Calculate aggregate signal statistics from a mixed set of signals.
 */
export function calculateSignalStats(
    reversionSignals: ReversionSignal[],
    trendSignals: TrendSignal[]
): SignalStats {
    const all = [
        ...reversionSignals.map(s => s.outcome),
        ...trendSignals.map(s => s.outcome)
    ];
    
    const wins = all.filter(o => o === 'WIN').length;
    const losses = all.filter(o => o === 'LOSS').length;
    const pending = all.filter(o => o === 'PENDING').length;
    const resolved = wins + losses;
    const winRate = resolved > 0 ? (wins / resolved) * 100 : 0;
    
    return { wins, losses, pending, winRate: parseFloat(winRate.toFixed(1)) };
}
