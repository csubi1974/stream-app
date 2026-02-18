
import { TradeAlertService, TradeAlert } from './tradeAlertService.js';
import { GEXService, GEXMetrics } from './gexService.js';
import { SchwabService } from './schwabService.js';
import { getDb } from '../database/sqlite.js';

export interface BacktestSummary {
    symbol: string;
    totalSnapshots: number;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    periodStart: string;
    periodEnd: string;
}

export interface BacktestSignal {
    time: string;
    entryPrice: number;
    strategy: string;
    shortStrike: number;
    credit: number;
    result: 'WIN' | 'LOSS' | 'OPEN';
    exitPrice?: number;
    exitTime?: string;
    pnl: number;
    quality: number;
}

export class BacktestService {
    private tradeAlertService: TradeAlertService;
    private gexService: GEXService;

    constructor(schwabService: SchwabService) {
        this.tradeAlertService = new TradeAlertService(schwabService);
        this.gexService = new GEXService(schwabService);
    }

    async getStats(symbol: string = 'SPX') {
        const db = getDb();
        const counts = await db.get(`
            SELECT COUNT(*) as count, MIN(snapshot_time) as first, MAX(snapshot_time) as last 
            FROM options_chain_snapshots 
            WHERE symbol = ?
        `, [symbol]);

        const uniqueTimes = await db.all(`
            SELECT COUNT(DISTINCT snapshot_time) as distinct_times
            FROM options_chain_snapshots
            WHERE symbol = ?
        `, [symbol]);

        return {
            totalRecords: counts?.count || 0,
            totalSnapshots: uniqueTimes[0]?.distinct_times || 0,
            firstSnapshot: counts?.first,
            lastSnapshot: counts?.last,
            symbol
        };
    }

    async run(symbol: string = 'SPX'): Promise<{ summary: BacktestSummary, signals: BacktestSignal[] }> {
        const db = getDb();

        // 1. Get all unique snapshots
        const snapshots = await db.all(`
            SELECT DISTINCT snapshot_time, underlying_price 
            FROM options_chain_snapshots 
            WHERE symbol = ? 
            ORDER BY snapshot_time ASC
        `, [symbol]);

        if (snapshots.length === 0) {
            throw new Error(`No data found for ${symbol} to backtest.`);
        }

        const allSignals: BacktestSignal[] = [];
        let wins = 0;
        let losses = 0;
        let totalPnLValue = 0;

        // 2. Loop through snapshots
        for (let i = 0; i < snapshots.length; i++) {
            const snap = snapshots[i];
            const time = snap.snapshot_time;
            const price = snap.underlying_price;

            if (!price) continue;

            const optionsRows = await db.all(`
                SELECT * FROM options_chain_snapshots 
                WHERE symbol = ? AND snapshot_time = ?
            `, [symbol, time]);

            if (optionsRows.length === 0) continue;

            // Reconstruct "chain" object
            const chain = this.reconstructChain(symbol, price, optionsRows);
            const currentDay = time.split('T')[0];
            const gexMetrics = await this.gexService.calculateGEXMetricsFromData(symbol, chain);
            const alerts = await this.tradeAlertService.generateAlertsFromData(symbol, gexMetrics, chain, currentDay);

            for (const alert of alerts) {
                if (alert.id.startsWith('warning')) continue;

                // Evaluate outcome
                const outcome = this.evaluateSignal(alert, i, snapshots, currentDay);

                if (outcome.result === 'WIN') {
                    wins++;
                    totalPnLValue += alert.netCredit * 100;
                } else if (outcome.result === 'LOSS') {
                    losses++;
                    totalPnLValue -= alert.maxLoss * 100;
                }

                allSignals.push({
                    time,
                    entryPrice: price,
                    strategy: alert.strategyLabel,
                    shortStrike: alert.legs.find(l => l.action === 'SELL')?.strike || 0,
                    credit: alert.netCredit,
                    result: outcome.result,
                    exitPrice: outcome.exitPrice,
                    exitTime: outcome.exitTime,
                    pnl: outcome.result === 'WIN' ? alert.netCredit * 100 : (outcome.result === 'LOSS' ? -alert.maxLoss * 100 : 0),
                    quality: alert.qualityScore || 0
                });
            }
        }

        const totalTrades = wins + losses;
        const winRateValue = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

        return {
            summary: {
                symbol,
                totalSnapshots: snapshots.length,
                totalTrades,
                wins,
                losses,
                winRate: winRateValue,
                totalPnL: totalPnLValue,
                periodStart: snapshots[0].snapshot_time,
                periodEnd: snapshots[snapshots.length - 1].snapshot_time
            },
            signals: allSignals
        };
    }

    private reconstructChain(symbol: string, price: number, rows: any[]) {
        return {
            symbol,
            underlyingPrice: price,
            underlying: { last: price },
            calls: rows.filter(r => r.type === 'CALL').map(r => this.mapRowToOption(r)),
            puts: rows.filter(r => r.type === 'PUT').map(r => this.mapRowToOption(r))
        };
    }

    private mapRowToOption(r: any) {
        return {
            strikePrice: r.strike,
            putCall: r.type,
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
        };
    }

    private evaluateSignal(alert: TradeAlert, currentIndex: number, snapshots: any[], currentDay: string) {
        let result: 'WIN' | 'LOSS' | 'OPEN' = 'OPEN';
        let exitPrice = snapshots[currentIndex].underlying_price;
        let exitTime = snapshots[currentIndex].snapshot_time;

        const sellLegs = alert.legs.filter(l => l.action === 'SELL');
        const shortPut = sellLegs.find(l => l.type === 'PUT')?.strike || 0;
        const shortCall = sellLegs.find(l => l.type === 'CALL')?.strike || 0;

        for (let j = currentIndex + 1; j < snapshots.length; j++) {
            const futureSnap = snapshots[j];
            const futureDay = futureSnap.snapshot_time.split('T')[0];
            if (futureDay !== currentDay) break;

            const futurePrice = futureSnap.underlying_price;

            // Breach check
            const breachedPut = shortPut > 0 && futurePrice <= shortPut;
            const breachedCall = shortCall > 0 && futurePrice >= shortCall;

            if (breachedPut || breachedCall) {
                result = 'LOSS';
                exitPrice = futurePrice;
                exitTime = futureSnap.snapshot_time;
                break;
            }

            if (j === snapshots.length - 1 || snapshots[j + 1].snapshot_time.split('T')[0] !== currentDay) {
                result = 'WIN';
                exitPrice = futurePrice;
                exitTime = futureSnap.snapshot_time;
            }
        }

        return { result, exitPrice, exitTime };
    }
}
