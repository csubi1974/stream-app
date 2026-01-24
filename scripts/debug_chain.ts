
import dotenv from 'dotenv';
import { SchwabService } from '../api/services/schwabService.js';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debug() {
    console.log('🔍 Starting Schwab Chain Debug...');

    try {
        const service = new SchwabService();
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!service.isConnected()) {
            console.error('NOT CONNECTED'); return;
        }

        console.log('Trying SPX...');
        let chain = await service.getOptionsChain('SPX');

        if (!chain) {
            console.log('SPX failed (returned null). Trying $SPX...');
            chain = await service.getOptionsChain('$SPX');
        }

        if (!chain) {
            console.error('❌ Chain response was NULL for both.');
            return;
        }

        console.log('📦 Chain Response Keys:', Object.keys(chain));
        if (chain.status) console.log('Status:', chain.status);

        let callDates: string[] = [];
        if (chain.callExpDateMap) {
            callDates = Object.keys(chain.callExpDateMap);
            console.log(`📅 Found ${callDates.length} Call Expirations.`);
            console.log('First 3:', callDates.slice(0, 3));
        }

    } catch (e) {
        console.error('❌ Fatal Error:', e);
    }
}

debug();
