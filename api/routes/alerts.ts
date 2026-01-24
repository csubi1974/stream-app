import { Router } from 'express';
import { TradeAlertService } from '../services/tradeAlertService.js';
import { SchwabService } from '../services/schwabService.js';

const router = Router();
const schwabService = new SchwabService();
const tradeAlertService = new TradeAlertService(schwabService);

/**
 * GET /api/alerts/strategies
 * Obtiene alertas de estrategias generadas basadas en condiciones actuales
 */
router.get('/strategies', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string) || 'SPX';
        const alerts = await tradeAlertService.generateAlerts(symbol);

        res.json({
            success: true,
            count: alerts.length,
            alerts,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error fetching trade alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate trade alerts',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/alerts/history
 * Obtiene el historial de señales filtrado por fecha
 */
router.get('/history', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string) || 'SPX';
        const date = req.query.date as string; // Esperado: YYYY-MM-DD
        const alerts = await tradeAlertService.getAlertHistory(date, symbol);

        res.json({
            success: true,
            alerts
        });
    } catch (error) {
        console.error('❌ Error fetching alert history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alert history'
        });
    }
});

/**
 * GET /api/alerts/status
 * Verifica el estado del motor de alertas
 */
router.get('/status', async (req, res) => {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
            weekday: 'long'
        });

        const nyTime = formatter.format(now);

        res.json({
            success: true,
            status: 'operational',
            marketTime: nyTime,
            spreadWidth: 5,
            supportedStrategies: ['BULL_PUT_SPREAD', 'BEAR_CALL_SPREAD', 'IRON_CONDOR']
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Alert engine status check failed'
        });
    }
});

export default router;
