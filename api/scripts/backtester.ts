
import { TradeAlertService, TradeAlert } from '../services/tradeAlertService.js';
import { GEXService } from '../services/gexService.js';
import { SchwabService } from '../services/schwabService.js';
import { initializeDb, getDb } from '../database/sqlite.js';
import fs from 'fs';
import path from 'path';

/**
 * Backtester Tool
 * Runs the signal logic over historical data recorded in SQLite
 */
async function runBacktest(symbol: string = 'SPX') {
    console.log('🧪 --- STARTING BACKTEST --- 🧪');

    // 1. Initialize DB
    const db = await initializeDb();

    // 2. Initialize Services (Schwab is just a shell here, we use Data methods)
    const schwabService = new SchwabService();
    const tradeAlertService = new TradeAlertService(schwabService);
    const gexService = new GEXService(schwabService);

    // 3. Get all unique snapshots
    console.log(`🔍 Fetching snapshots for ${symbol}...`);
    const snapshots = await db.all(`
        SELECT DISTINCT snapshot_time, underlying_price 
        FROM options_chain_snapshots 
        WHERE symbol = ? 
        ORDER BY snapshot_time ASC
    `, [symbol]);

    console.log(`📈 Found ${snapshots.length} snapshots to process.`);

    const allSignals: any[] = [];
    let wins = 0;
    let losses = 0;
    let totalPnL = 0;

    // 4. Loop through snapshots
    for (let i = 0; i < snapshots.length; i++) {
        const snap = snapshots[i];
        const time = snap.snapshot_time;
        const price = snap.underlying_price;

        if (!price) continue;

        // Load option data for this snapshot
        const optionsRows = await db.all(`
            SELECT * FROM options_chain_snapshots 
            WHERE symbol = ? AND snapshot_time = ?
        `, [symbol, time]);

        if (optionsRows.length === 0) continue;

        // Reconstruct "chain" object
        const chain = {
            symbol,
            underlyingPrice: price,
            underlying: { last: price },
            calls: optionsRows.filter(r => r.type === 'CALL').map(r => ({
                strikePrice: r.strike,
                putCall: 'CALL',
                bid: r.bid,
                ask: r.ask,
                last: r.last,
                totalVolume: r.volume,
                openInterest: r.open_interest,
                delta: r.delta,
                gamma: r.gamma,
                theta: r.theta,
                vega: r.vega,
                expirationDate: r.expiration_date
            })),
            puts: optionsRows.filter(r => r.type === 'PUT').map(r => ({
                strikePrice: r.strike,
                putCall: 'PUT',
                bid: r.bid,
                ask: r.ask,
                last: r.last,
                totalVolume: r.volume,
                openInterest: r.open_interest,
                delta: r.delta,
                gamma: r.gamma,
                theta: r.theta,
                vega: r.vega,
                expirationDate: r.expiration_date
            }))
        };

        const currentDay = time.split('T')[0];
        const gexMetrics = await gexService.calculateGEXMetricsFromData(symbol, chain);
        const alerts = await tradeAlertService.generateAlertsFromData(symbol, gexMetrics, chain, currentDay);

        for (const alert of alerts) {
            // Skip warning labels
            if (alert.id.startsWith('warning')) continue;

            console.log(`[${time}] 🔔 Signal: ${alert.strategyLabel} at $${price.toFixed(2)} | Net Credit: $${alert.netCredit}`);

            // --- EVALUATION ---
            // Find the outcome of this trade by looking at future snapshots of the same day
            let result: 'WIN' | 'LOSS' | 'OPEN' = 'OPEN';
            let exitPrice = price;
            let exitTime = time;
            let pnl = 0;

            const shortLeg = alert.legs.find(l => l.action === 'SELL');
            const shortStrike = shortLeg?.strike || 0;
            const isPutSpread = alert.strategy === 'BULL_PUT_SPREAD';

            // Check if stop loss (wall break) or expiration happened
            for (let j = i + 1; j < snapshots.length; j++) {
                const futureSnap = snapshots[j];
                const futureDay = futureSnap.snapshot_time.split('T')[0];
                if (futureDay !== currentDay) break;

                const futurePrice = futureSnap.underlying_price;

                // Check for Loss (Price crossed short strike)
                if (isPutSpread && futurePrice <= shortStrike) {
                    result = 'LOSS';
                    exitPrice = futurePrice;
                    exitTime = futureSnap.snapshot_time;
                    break;
                } else if (!isPutSpread && futurePrice >= shortStrike) {
                    result = 'LOSS';
                    exitPrice = futurePrice;
                    exitTime = futureSnap.snapshot_time;
                    break;
                }

                // If we reach the end of the snapshots for this day, it's a WIN (expired worthless)
                if (j === snapshots.length - 1 || snapshots[j + 1].snapshot_time.split('T')[0] !== currentDay) {
                    result = 'WIN';
                    exitPrice = futurePrice;
                    exitTime = futureSnap.snapshot_time;
                    // No break here, we want to see if it hits LOSS later in the day if snapshots continue
                }
            }

            if (result === 'WIN') {
                wins++;
                pnl = alert.netCredit * 100;
            } else if (result === 'LOSS') {
                losses++;
                pnl = -alert.maxLoss * 100;
            }

            totalPnL += pnl;

            allSignals.push({
                time,
                entryPrice: price,
                strategy: alert.strategyLabel,
                shortStrike,
                credit: alert.netCredit,
                result,
                exitPrice,
                exitTime,
                pnl,
                quality: alert.qualityScore
            });
        }
    }

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    console.log('\n--- BACKTEST SUMMARY ---');
    console.log(`Total Snapshots: ${snapshots.length}`);
    console.log(`Total Trades: ${totalTrades}`);
    console.log(`Wins: ${wins} | Losses: ${losses}`);
    console.log(`Win Rate: ${winRate.toFixed(1)}%`);
    console.log(`Total PnL: $${totalPnL.toFixed(2)}`);
    console.log('------------------------\n');

    // Save report to file
    const reportPath = path.join(process.cwd(), 'backtest_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        summary: {
            symbol,
            totalSnapshots: snapshots.length,
            totalTrades,
            wins,
            losses,
            winRate: `${winRate.toFixed(1)}%`,
            totalPnL: `$${totalPnL.toFixed(2)}`
        },
        signals: allSignals
    }, null, 2));
    console.log(`📊 Report saved to ${reportPath}`);
}

// Execute if run directly
const args = process.argv.slice(2);
const symbolArg = args[0] || 'SPX';

runBacktest(symbolArg).catch(console.error);
