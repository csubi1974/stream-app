
import { TradeAlertService } from './tradeAlertService.js';
import { SchwabService } from './schwabService.js';

export class SignalScheduler {
    private tradeAlertService: TradeAlertService;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private symbols: string[] = ['SPX']; // Default symbol

    constructor(tradeAlertService: TradeAlertService) {
        this.tradeAlertService = tradeAlertService;
    }

    /**
     * Start the background signal generation process
     * @param intervalMs Interval in milliseconds (default 5 minutes)
     */
    public start(intervalMs: number = 5 * 60 * 1000) {
        if (this.isRunning) {
            console.log('🔄 Signal Scheduler is already running');
            return;
        }

        console.log(`🚀 Starting Signal Scheduler (Interval: ${intervalMs / 1000 / 60} min)`);
        this.isRunning = true;

        // Run immediately on start
        this.generateSignals();

        // Schedule periodic runs
        this.intervalId = setInterval(() => {
            this.generateSignals();
        }, intervalMs);
    }

    /**
     * Stop the background signal generation process
     */
    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Signal Scheduler stopped');
    }

    /**
     * Trigger signal generation for all configured symbols
     */
    private async generateSignals() {
        console.log(`⏱️  [${new Date().toLocaleTimeString()}] Running background signal generation...`);

        for (const symbol of this.symbols) {
            try {
                const alerts = await this.tradeAlertService.generateAlerts(symbol);
                console.log(`✅ Generated ${alerts.length} signals for ${symbol}`);
            } catch (error) {
                console.error(`❌ Failed to generate background signals for ${symbol}:`, error);
            }
        }
    }

    /**
     * Update the list of symbols to monitor
     */
    public setSymbols(symbols: string[]) {
        this.symbols = symbols;
    }
}
