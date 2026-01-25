
import axios from 'axios';

export interface ScrapedEvent {
    id: string;
    time: string;
    currency: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    event: string;
    actual: string;
    forecast: string;
    previous: string;
}

export class ForexFactoryScraper {
    private readonly BASE_URL = 'https://www.forexfactory.com/calendar';

    /**
     * Scrape events for a specific date (format: MmmDD.yyyy e.g., jan24.2025)
     * If no date provided, defaults to today
     */
    async scrapeEvents(dateStr?: string): Promise<ScrapedEvent[]> {
        try {
            const url = dateStr ? `${this.BASE_URL}?day=${dateStr}` : this.BASE_URL;
            // console.log(`🕵️ Scraping Forex Factory: ${url}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            return this.parseHtml(response.data);
        } catch (error) {
            console.error('❌ Error scraping Forex Factory:', error.message);
            return [];
        }
    }

    private parseHtml(html: string): ScrapedEvent[] {
        const events: ScrapedEvent[] = [];

        // Simple regex-based extraction (lighter than cheerio for this specific table structure)
        // We look for the table rows in the calendar

        // This is a simplified parser. The actual HTML structure is complex.
        // We will look for data-event-id patterns which usually contain the row data

        const rowRegex = /<tr class="calendar_row[\s\S]*?<\/tr>/g;
        const matches = html.match(rowRegex);

        if (!matches) return [];

        for (const row of matches) {
            // Extract Time
            const timeMatch = row.match(/class="calendar__time"[^>]*>([\s\S]*?)<\/td>/);
            let time = timeMatch ? timeMatch[1].trim() : '';
            // Clean time tag if present
            time = time.replace(/<[^>]*>/g, '').trim();

            // Extract Currency
            const currencyMatch = row.match(/class="calendar__currency"[^>]*>([\s\S]*?)<\/td>/);
            const currency = currencyMatch ? currencyMatch[1].trim() : '';

            // Extract Impact (color)
            let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
            if (row.includes('impact-red')) impact = 'HIGH';
            else if (row.includes('impact-orange')) impact = 'MEDIUM';
            else if (row.includes('impact-yellow')) impact = 'LOW';

            // Extract Event Name
            const eventMatch = row.match(/class="calendar__event-title"[^>]*>([\s\S]*?)<\/span>/);
            const event = eventMatch ? eventMatch[1].trim() : '';

            // Extract Actual
            const actualMatch = row.match(/class="calendar__actual"[^>]*>([\s\S]*?)<\/td>/);
            let actual = actualMatch ? actualMatch[1].trim() : '';
            actual = actual.replace(/<[^>]*>/g, '').trim();

            // Extract Forecast
            const forecastMatch = row.match(/class="calendar__forecast"[^>]*>([\s\S]*?)<\/td>/);
            let forecast = forecastMatch ? forecastMatch[1].trim() : '';
            forecast = forecast.replace(/<[^>]*>/g, '').trim();

            // Extract Previous
            const previousMatch = row.match(/class="calendar__previous"[^>]*>([\s\S]*?)<\/td>/);
            let previous = previousMatch ? previousMatch[1].trim() : '';
            previous = previous.replace(/<[^>]*>/g, '').trim();

            // ID
            const idMatch = row.match(/data-event-id="(\d+)"/);
            const id = idMatch ? idMatch[1] : `evt-${Math.random()}`;

            // Filter out empty rows or non-relevant currencies if needed (optional)
            if (currency && event) {
                events.push({
                    id,
                    time,
                    currency,
                    impact,
                    event,
                    actual,
                    forecast,
                    previous
                });
            }
        }

        return events;
    }
}
