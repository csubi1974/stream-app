
import axios from 'axios';

export interface ScrapedEvent {
    id: string;
    time: string;
    date: string;
    currency: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    event: string;
    actual: string;
    forecast: string;
    previous: string;
}

export class ForexFactoryScraper {
    private readonly JSON_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

    /**
     * Fetch events from Forex Factory's JSON feed.
     * The feed usually contains events for the current week.
     */
    async scrapeEvents(dateStr?: string): Promise<ScrapedEvent[]> {
        try {
            // console.log(`🕵️ Fetching Forex Factory JSON: ${this.JSON_URL}`);
            const response = await axios.get(this.JSON_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const rawEvents = response.data;
            if (!Array.isArray(rawEvents)) return [];

            const events = rawEvents.map((item: any, index: number) => {
                // Map impact
                let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
                const rawImpact = (item.impact || '').toLowerCase();
                if (rawImpact === 'high') impact = 'HIGH';
                else if (rawImpact === 'medium') impact = 'MEDIUM';
                else if (rawImpact === 'low') impact = 'LOW';

                return {
                    id: `ff-${index}-${item.date}`,
                    date: item.date, // Format: "YYYY-MM-DD" usually, but let's check
                    time: item.time, // Format: "12:30pm"
                    currency: item.country, // "USD", "EUR", etc.
                    impact,
                    event: item.title,
                    actual: item.actual || '',
                    forecast: item.forecast || '',
                    previous: item.previous || ''
                };
            });

            if (dateStr) {
                // ForexFactory JSON dates are usually ISO or similar. 
                // We might need to normalize dateStr to match item.date.
                // The dateStr passed from EconomicCalendarService is currently "MmmDD.yyyy".
                // Let's try to filter by the normalized date if possible.
                // However, the JSON feed is small enough that we can just return it all 
                // and let the service handle the filter if needed, or filter here.

                // For now, let's just return all and fix the service to filter correctly.
            }

            return events;
        } catch (error) {
            console.error('❌ Error fetching Forex Factory JSON:', error.message);
            return [];
        }
    }
}
