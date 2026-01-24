
import dotenv from 'dotenv';
import { SchwabService } from '../api/services/schwabService.js';
import { MarketDataService } from '../api/services/marketDataService.js';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debug() {
    console.log('🔍 Debug: Testing MarketDataService.getZeroDTEOptions(AAPL)...');

    const schwab = new SchwabService();
    const market = new MarketDataService(schwab);

    // Waiting for tokens load
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        console.log('🚀 Calling getZeroDTEOptions...');
        const result = await market.getZeroDTEOptions('AAPL');

        console.log('📊 Result Stats:', result.stats);
        if (result.options && result.options.length > 0) {
            console.log(`✅ Success! Got ${result.options.length} options.`);
            console.log('First Option:', result.options[0]);
        } else {
            console.log('❌ Result options empty.');
        }
    } catch (e) {
        console.error('❌ Error:', e);
    }

    process.exit(0);
}
debug();
