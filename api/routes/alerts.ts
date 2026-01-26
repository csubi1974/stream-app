import { Router } from 'express';
import { TradeAlertService } from '../services/tradeAlertService.js';
import { getSchwabService } from '../services/schwabServiceSingleton.js';

const router = Router();
const schwabService = getSchwabService();
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

/**
 * PUT /api/alerts/:id/result
 * Update the result of a trade alert (Settlement)
 * Body: { result: 'WIN'|'LOSS', realizedPnl: number, closedAtPrice: number }
 */
router.put('/:id/result', async (req, res) => {
    try {
        const { id } = req.params;
        const { result, realizedPnl, closedAtPrice } = req.body;

        if (!result || realizedPnl === undefined || closedAtPrice === undefined) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: result, realizedPnl, closedAtPrice'
            });
            return;
        }

        const success = await tradeAlertService.updateAlertResult(
            id,
            result,
            Number(realizedPnl),
            Number(closedAtPrice)
        );

        res.json({
            success,
            message: success ? 'Alert result updated successfully' : 'Alert not found'
        });
    } catch (error) {
        console.error('❌ Error updating alert result:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update alert result'
        });
    }
});

export default router;
