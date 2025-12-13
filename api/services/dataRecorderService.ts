
import { SchwabService } from './schwabService.js';
import { getDb } from '../database/sqlite.js';

export class DataRecorderService {
    private schwabService: SchwabService;
    private isRecording: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private symbols: string[] = ['SPX']; // Default to SPX

    constructor(schwabService: SchwabService) {
        this.schwabService = schwabService;
    }

    async startRecording(intervalMs: number = 60000) { // Default 1 min
        if (this.isRecording) return;

        console.log('📼 Starting Data Recorder Service...');
        this.isRecording = true;

        // Initial record
        await this.recordSnapshots();

        this.intervalId = setInterval(async () => {
            await this.recordSnapshots();
        }, intervalMs);
    }

    stopRecording() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRecording = false;
        console.log('Hz Data Recorder stopped.');
    }

    private async recordSnapshots() {
        const db = getDb();
        const now = new Date().toISOString();
        console.log(`📼 Recording snapshot for ${this.symbols.join(', ')} at ${now}`);

        for (const symbol of this.symbols) {
            try {
                const chain = await this.schwabService.getOptionsChain(symbol);
                if (!chain) continue;

                // Flatten data
                const options = [
                    ...(chain.calls || []),
                    ...(chain.puts || [])
                ];

                // Prepare batch insert (using transaction for speed)
                // Note: Filter for near-term or just save all? 
                // A full SPX chain is HUGE. Let's filter for 0DTE and 1DTE for now to save space, 
                // or user can specify. Let's assume user wants "at least SPX".
                // Pro tip: Filter out deep OTM options to save space?
                // Let's safe-guard by filtering only options with Volume > 0 or OI > 100 to avoid junk.

                const activeOptions = options.filter((o: any) => (o.totalVolume > 0 || o.openInterest > 100));

                if (activeOptions.length === 0) continue;

                // Construct query
                // Using a transaction is much faster
                await db.exec('BEGIN TRANSACTION');

                const stmt = await db.prepare(`
          INSERT INTO options_chain_snapshots (
            symbol, snapshot_time, expiration_date, strike, type, 
            bid, ask, last, volume, open_interest, 
            delta, gamma, theta, vega
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

                for (const opt of activeOptions) {
                    await stmt.run(
                        symbol,
                        now,
                        opt.expirationDate,
                        opt.strikePrice,
                        opt.putCall,
                        opt.bid,
                        opt.ask,
                        opt.last,
                        opt.totalVolume,
                        opt.openInterest,
                        opt.delta,
                        opt.gamma,
                        opt.theta,
                        opt.vega
                    );
                }

                await stmt.finalize();
                await db.exec('COMMIT');

                console.log(`✅ Saved ${activeOptions.length} option records for ${symbol}`);

            } catch (error) {
                console.error(`❌ Error recording ${symbol}:`, error);
                try { await db.exec('ROLLBACK'); } catch (e) { }
            }
        }
    }
}
