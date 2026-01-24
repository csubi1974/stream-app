import { Router } from 'express';
import { GEXService } from '../services/gexService.js';
import { SchwabService } from '../services/schwabService.js';

const router = Router();
const schwabService = new SchwabService();
const gexService = new GEXService(schwabService);

/**
 * GET /api/gex/metrics
 * Obtiene todas las métricas GEX avanzadas
 */
router.get('/metrics', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string) || 'SPX';
        const metrics = await gexService.calculateGEXMetrics(symbol);

        res.json(metrics);
    } catch (error) {
        console.error('❌ Error fetching GEX metrics:', error);
        res.status(500).json({
            error: 'Failed to fetch GEX metrics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/gex/0dte
 * Obtiene métricas GEX solo para opciones 0DTE
 */
router.get('/0dte', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string) || 'SPX';
        const metrics = await gexService.calculate0DTEGEXMetrics(symbol);

        res.json(metrics);
    } catch (error) {
        console.error('❌ Error fetching 0DTE GEX metrics:', error);
        res.status(500).json({
            error: 'Failed to fetch 0DTE GEX metrics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
