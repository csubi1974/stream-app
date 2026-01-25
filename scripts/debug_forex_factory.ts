
import { ForexFactoryScraper } from '../api/services/forexFactoryScraper';

async function testScraper() {
    console.log('🧪 Testing Forex Factory Scraper...');
    const scraper = new ForexFactoryScraper();

    // Test today
    console.log('\n📅 Scraping TODAY...');
    const eventsToday = await scraper.scrapeEvents();
    console.log(`✅ Found ${eventsToday.length} events for today`);
    if (eventsToday.length > 0) {
        console.log('Sample event:', eventsToday[0]);
    } else {
        console.log('⚠️ No events found. Might be blocked or parsing error.');
    }

    // Test specific date (e.g., next Monday)
    // Format: jan27.2025
    console.log('\n📅 Scraping FUTURE date (jan27.2025)...');
    const eventsFuture = await scraper.scrapeEvents('jan27.2025');
    console.log(`✅ Found ${eventsFuture.length} events for future date`);
    if (eventsFuture.length > 0) {
        console.log('Sample event:', eventsFuture[0]);
    }
}

testScraper();
