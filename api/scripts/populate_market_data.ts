
import fs from 'fs';
import path from 'path';

const FALLBACK_PATH = './market_data_fallback.json';

function generateData() {
    console.log('🔄 Reading market_data_fallback.json...');
    const rawData = fs.readFileSync(FALLBACK_PATH, 'utf8');
    const data = JSON.parse(rawData);

    // Get the base QQQ snapshots (first available timestamp)
    const baseSnapshots = data.snapshots.filter((s: any) => s.symbol === 'QQQ');
    if (baseSnapshots.length === 0) {
        console.error('❌ No QQQ snapshots found to use as base.');
        return;
    }

    // Find the first timestamp to use as a starting point
    const firstTime = baseSnapshots[0].snapshot_time;
    const baseSet = baseSnapshots.filter((s: any) => s.snapshot_time === firstTime);

    console.log(`ℹ️ Found ${baseSet.length} option rows for QQQ at ${firstTime}`);

    const newSnapshots: any[] = [];
    const startTime = new Date(firstTime);

    // Generate 50 intervals (every 5 mins)
    // Scenario: Market chops around then trends down, triggering potential stop losses for Put Spreads
    // or trends up for Call Spreads.

    let currentPrice = baseSet[0].underlying_price;
    console.log(`Starting Price: $${currentPrice}`);

    for (let i = 1; i <= 60; i++) {
        const time = new Date(startTime.getTime() + i * 5 * 60000); // +5 min

        // Random walk price simulation (-0.1% to +0.1%)
        const priceChangePct = (Math.random() * 0.004 - 0.002);
        const priceChange = currentPrice * priceChangePct;
        currentPrice += priceChange;

        // Map original rows to new time and adjusted prices
        // Note: We use the *original* option price as base to avoid drift accumulation error, 
        // effectively re-pricing based on total move from start (simplified) -> ACTUALLY NO, easier to step.
        // But stepping accumulates error. Let's step from previous set?
        // For simplicity, we just apply the change to the *original* snapshot price based on difference from original underlying.

        const totalUnderlyingChange = currentPrice - baseSet[0].underlying_price;

        const stepSnapshots = baseSet.map((s: any) => {
            const newOptionPrice = Math.max(0.01, s.last + (totalUnderlyingChange * (s.delta || 0.5)));
            const newBid = Math.max(0.01, s.bid + (totalUnderlyingChange * (s.delta || 0.5)));
            const newAsk = Math.max(0.01, s.ask + (totalUnderlyingChange * (s.delta || 0.5)));

            // Boosting OI for specific strikes to ensure we have a SOLID WALL for testing
            let augmentedOI = s.open_interest;
            if (s.strike === 617 || s.strike === 618) {
                augmentedOI = 8500; // Force solid wall
            }

            return {
                ...s,
                snapshot_time: time.toISOString(),
                underlying_price: parseFloat(currentPrice.toFixed(2)),
                last: parseFloat(newOptionPrice.toFixed(2)),
                bid: parseFloat(newBid.toFixed(2)),
                ask: parseFloat(newAsk.toFixed(2)),
                open_interest: augmentedOI
            };
        });

        newSnapshots.push(...stepSnapshots);
    }

    // Append to existing
    data.snapshots.push(...newSnapshots);

    // Deduplicate just in case
    const unique = new Map();
    data.snapshots.forEach((s: any) => unique.set(s.symbol + s.snapshot_time + s.strike + s.type, s));
    data.snapshots = Array.from(unique.values());

    console.log(`✅ Added ${newSnapshots.length} simulated snapshots.`);
    console.log(`Total snapshots: ${data.snapshots.length}`);

    fs.writeFileSync(FALLBACK_PATH, JSON.stringify(data, null, 2));
    console.log('💾 Saved to market_data_fallback.json');
}

generateData();
