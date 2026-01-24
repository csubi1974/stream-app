
import { initializeDb, getDb } from '../api/database/sqlite.js';

async function seedTestAlert() {
    console.log('🧪 Seeding test alert to verify persistence...');

    // 1. Initialize DB
    await initializeDb();
    const db = getDb();

    // 2. Create a mock alert
    const targetExecutionPrice = 6000;
    const now = new Date().toISOString();

    const mockAlert = {
        id: `TEST-BPS-${Date.now()}`,
        strategy: 'BULL_PUT_SPREAD',
        strategyLabel: 'TEST: Bull Put Spread',
        underlying: 'SPX',
        expiration: '2026-01-26',
        legs: [
            { action: 'SELL', type: 'PUT', strike: 5950, price: 12.5, delta: -0.20 },
            { action: 'BUY', type: 'PUT', strike: 5945, price: 10.2, delta: -0.15 }
        ],
        netCredit: 2.3,
        maxLoss: 2.7,
        maxProfit: 2.3,
        probability: 78.5,
        riskReward: '1:1.2',
        rationale: 'TEST ALERT: Generated manually to verify database persistence and history view.',
        status: 'ACTIVE',
        gexContext: {
            regime: 'stable',
            callWall: 6100,
            putWall: 5900,
            gammaFlip: 5950,
            currentPrice: 6020,
            netDrift: 0.85,
            expectedMove: 45.5
        },
        generatedAt: now,
        validUntil: new Date(Date.now() + 3600000).toISOString()
    };

    // 3. Save it
    try {
        await db.run(`
            INSERT OR IGNORE INTO trade_alerts (
                id, strategy, underlying, generated_at, status, alert_data
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            mockAlert.id,
            mockAlert.strategy,
            mockAlert.underlying,
            mockAlert.generatedAt,
            mockAlert.status,
            JSON.stringify(mockAlert)
        ]);

        console.log('✅ Mock alert saved successfully!');

        // 4. Verify
        const result = await db.get('SELECT * FROM trade_alerts WHERE id = ?', [mockAlert.id]);
        if (result) {
            console.log('🔍 Verification: Alert found in DB with ID:', result.id);
            console.log('📅 Generated At:', result.generated_at);
        } else {
            console.error('❌ Verification FAILED: Alert not found in DB.');
        }

    } catch (error) {
        console.error('❌ Error saving mock alert:', error);
    }
}

seedTestAlert();
