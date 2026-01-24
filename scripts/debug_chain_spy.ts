
import dotenv from 'dotenv';
import { SchwabService } from '../api/services/schwabService.js';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debug() {
    console.log('🔍 Debug: Testing SPY...');
    const service = new SchwabService();
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        console.log('📡 Fetching SPY Chain...');
        const chain = await service.getOptionsChain('SPY');

        if (chain) {
            console.log('✅ SPY Success!');
            const keys = Object.keys(chain);
            console.log('Keys:', keys);

            if (chain.callExpDateMap) {
                console.log('📅 Call Expirations:', Object.keys(chain.callExpDateMap).slice(0, 3));
            }
            if (chain.errors) {
                console.error('⚠️ Chain has errors:', chain.errors);
            }
        } else {
            console.log('❌ SPY returned null/error');
        }
    } catch (e) {
        console.error('Failure:', e);
    }
    process.exit(0);
}
debug();
