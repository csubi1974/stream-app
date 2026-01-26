import { Router } from 'express';
import { getSchwabService } from '../services/schwabServiceSingleton.js';

const router = Router();
const schwabService = getSchwabService();

/**
 * GET /api/test/schwab-connection
 * Prueba la conexión con Schwab API
 */
router.get('/schwab-connection', async (req, res) => {
    try {
        const isConnected = schwabService.isConnected();

        if (!isConnected) {
            return res.json({
                connected: false,
                message: 'No hay token de acceso disponible',
                authUrl: schwabService.getAuthUrl()
            });
        }

        // Intentar obtener una cotización simple
        const testSymbol = 'SPY';
        console.log(`🧪 Testing Schwab connection with ${testSymbol}...`);

        const quotes = await schwabService.getQuotes([testSymbol]);

        res.json({
            connected: true,
            message: 'Conexión exitosa con Schwab API',
            testQuote: quotes,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('❌ Schwab connection test failed:', error);
        res.status(500).json({
            connected: false,
            error: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

/**
 * GET /api/test/options-chain
 * Prueba obtener cadena de opciones
 */
router.get('/options-chain', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string) || 'SPY';
        console.log(`🧪 Testing Options Chain for ${symbol}...`);

        const chain = await schwabService.getOptionsChain(symbol);

        if (!chain) {
            return res.json({
                success: false,
                message: 'No se pudo obtener la cadena de opciones',
                symbol
            });
        }

        res.json({
            success: true,
            symbol,
            hasCallMap: !!chain.callExpDateMap,
            hasPutMap: !!chain.putExpDateMap,
            underlyingPrice: chain.underlying?.last || chain.underlyingPrice,
            expirationDates: Object.keys(chain.callExpDateMap || {}),
            sampleData: {
                calls: Object.keys(chain.callExpDateMap || {}).slice(0, 2),
                puts: Object.keys(chain.putExpDateMap || {}).slice(0, 2)
            }
        });
    } catch (error: any) {
        console.error('❌ Options chain test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
