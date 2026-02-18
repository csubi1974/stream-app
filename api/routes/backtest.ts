
import express from 'express';
import { BacktestService } from '../services/backtestService.js';
import { SchwabService } from '../services/schwabService.js';

export function createBacktestRouter(schwabService: SchwabService) {
    const router = express.Router();
    const backtestService = new BacktestService(schwabService);

    // Get DB statistics for backtesting
    router.get('/stats/:symbol', async (req, res) => {
        try {
            const { symbol } = req.params;
            const stats = await backtestService.getStats(symbol);
            res.json(stats);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Run a backtest for a specific symbol
    router.post('/run', async (req, res) => {
        try {
            const { symbol = 'SPX' } = req.body;
            const results = await backtestService.run(symbol);
            res.json(results);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
