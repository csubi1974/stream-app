
import dotenv from 'dotenv';
import { SchwabService } from '../api/services/schwabService.js';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debug() {
    console.log('🔍 Debug: Testing $SPX only...');
    const service = new SchwabService();
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        const chain = await service.getOptionsChain('$SPX');
        if (chain) {
            console.log('✅ $SPX Success!');
            console.log('Keys:', Object.keys(chain));
        } else {
            console.log('❌ $SPX returned null/error');
        }
    } catch (e) {
        console.error('Failure:', e);
    }
}
debug();
