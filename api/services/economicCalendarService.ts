
interface EconomicEvent {
    id: string;
    date: string;
    time: string;
    event: string;
    country: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    actual?: string;
    forecast?: string;
    previous?: string;
    isLive?: boolean;
}

import { ForexFactoryScraper } from './forexFactoryScraper.js';

export class EconomicCalendarService {
    private scraper: ForexFactoryScraper;

    constructor() {
        this.scraper = new ForexFactoryScraper();
    }

    private static readonly STATIC_EVENTS = [
        // JANUARY 2026
        { date: '2026-01-09', time: '08:30', event: 'Employment Situation (NFP)', country: 'US', impact: 'HIGH' as const },
        { date: '2026-01-13', time: '08:30', event: 'Consumer Price Index (CPI)', country: 'US', impact: 'HIGH' as const },
        { date: '2026-01-26', time: '08:30', event: 'Durable Goods Orders', country: 'US', impact: 'MEDIUM' as const },
        { date: '2026-01-27', time: '14:00', event: 'FOMC Meeting - Day 1', country: 'US', impact: 'MEDIUM' as const },
        { date: '2026-01-28', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-01-29', time: '08:30', event: 'GDP Growth Rate (Advance)', country: 'US', impact: 'HIGH' as const },
        { date: '2026-01-30', time: '08:30', event: 'Producer Price Index (PPI)', country: 'US', impact: 'MEDIUM' as const },

        // FEBRUARY 2026
        { date: '2026-02-02', time: '10:00', event: 'ISM Manufacturing PMI', country: 'US', impact: 'HIGH' as const },
        { date: '2026-02-06', time: '08:30', event: 'Employment Report (NFP)', country: 'US', impact: 'HIGH' as const },
        { date: '2026-02-11', time: '08:30', event: 'Consumer Price Index (CPI)', country: 'US', impact: 'HIGH' as const },
        { date: '2026-02-18', time: '14:00', event: 'FOMC Minutes (Jan meeting)', country: 'US', impact: 'MEDIUM' as const },

        // FOMC Meetings Rest of 2026
        { date: '2026-03-18', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-04-29', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-06-17', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-07-29', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-09-16', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-10-28', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-12-09', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
    ];

    /**
     * Get economic events for today
     */
    async getEventsToday(): Promise<EconomicEvent[]> {
        const today = new Date().toISOString().split('T')[0];
        return this.getEventsByDate(today);
    }

    /**
     * Get economic events for this week
     */
    async getEventsThisWeek(): Promise<EconomicEvent[]> {
        const events: EconomicEvent[] = [];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayEvents = await this.getEventsByDate(dateStr);
            events.push(...dayEvents);
        }

        return events;
    }

    /**
     * Get economic events for next week
     */
    async getEventsNextWeek(): Promise<EconomicEvent[]> {
        const events: EconomicEvent[] = [];
        const today = new Date();

        for (let i = 7; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayEvents = await this.getEventsByDate(dateStr);
            events.push(...dayEvents);
        }

        return events;
    }

    /**
     * Get events by specific date
     */
    private async getEventsByDate(dateStr: string): Promise<EconomicEvent[]> {
        // Try to scrape real data first
        try {
            // Need to convert YYYY-MM-DD to MmmDD.yyyy (e.g. jan24.2025)
            const dateObj = new Date(dateStr);
            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

            const monthStr = months[dateObj.getMonth()];
            const formattedDate = `${monthStr}${dateObj.getDate()}.${dateObj.getFullYear()}`;

            // console.log(`🔍 Scraping events for: ${formattedDate}`);
            const scrapedEvents = await this.scraper.scrapeEvents(formattedDate);

            if (scrapedEvents && scrapedEvents.length > 0) {
                return scrapedEvents.map(e => ({
                    id: e.id,
                    date: dateStr,
                    time: e.time,
                    event: e.event,
                    country: this.mapCurrencyToCountry(e.currency),
                    impact: e.impact,
                    actual: e.actual,
                    forecast: e.forecast,
                    previous: e.previous,
                    isLive: false // We can't easily determine live status from scraper yet without accurate timezone parsing
                }));
            }
        } catch (error) {
            console.error(`⚠️ Failed to scrape events for ${dateStr}, falling back to static logic.`);
        }

        // FALLBACK: Static Logic if scraper fails
        const events: EconomicEvent[] = [];

        // Check static events (FOMC, etc.)
        const staticEvents = EconomicCalendarService.STATIC_EVENTS.filter(e => e.date === dateStr);
        staticEvents.forEach(e => {
            events.push({
                id: `${e.date}-${e.event.replace(/\s/g, '-')}`,
                date: e.date,
                time: e.time, // Assumed to be ET/NY Time
                event: e.event,
                country: e.country,
                impact: e.impact,
                isLive: this.isEventLive(dateStr, e.time)
            });
        });

        // Add common recurring events based on day of week
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        const dayOfMonth = date.getDate();

        // Weekly events
        if (dayOfWeek === 5) { // Friday
            events.push({
                id: `${dateStr}-nfp`,
                date: dateStr,
                time: '08:30', // NY Time
                event: 'Non-Farm Payrolls',
                country: 'US',
                impact: 'HIGH',
                forecast: '--',
                previous: '--'
            });
        }

        if (dayOfWeek === 4) { // Thursday
            events.push({
                id: `${dateStr}-jobless`,
                date: dateStr,
                time: '08:30', // NY Time
                event: 'Initial Jobless Claims',
                country: 'US',
                impact: 'MEDIUM',
                forecast: '--',
                previous: '--'
            });
        }

        // Monthly events (approximate - would need real API for exact dates)
        if (dayOfMonth >= 10 && dayOfMonth <= 15) {
            events.push({
                id: `${dateStr}-cpi`,
                date: dateStr,
                time: '08:30', // NY Time
                event: 'CPI (Consumer Price Index) MoM',
                country: 'US',
                impact: 'HIGH',
                forecast: '--',
                previous: '--'
            });
        }

        return events.sort((a, b) => a.time.localeCompare(b.time));
    }

    private mapCurrencyToCountry(currency: string): string {
        const map: Record<string, string> = {
            'USD': 'US',
            'EUR': 'EU',
            'GBP': 'UK',
            'JPY': 'JP',
            'CNY': 'CN',
            'CAD': 'CA',
            'AUD': 'AU',
            'CHF': 'CH'
        };
        return map[currency] || 'US';
    }

    /**
     * Get the next upcoming high-impact event
     */
    async getNextHighImpactEvent(): Promise<EconomicEvent | null> {
        const thisWeek = await this.getEventsThisWeek();
        const now = new Date();

        const upcoming = thisWeek.filter(event => {
            if (event.impact !== 'HIGH') return false;

            const eventDate = new Date();
            const [hours, minutes] = event.time.split(':');
            eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            return eventDate > now;
        });

        return upcoming.length > 0 ? upcoming[0] : null;
    }

    /**
     * Check if an event is currently live
     */
    private isEventLive(dateStr: string, timeStr: string): boolean {
        const now = new Date();
        const eventDate = new Date(dateStr);
        const [hours, minutes] = timeStr.split(':');
        eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Event is live if it's within 30 minutes of scheduled time
        const diff = now.getTime() - eventDate.getTime();
        return diff >= 0 && diff <= 30 * 60 * 1000;
    }

    /**
     * Get country flag emoji
     */
    static getCountryFlag(country: string): string {
        const flags: Record<string, string> = {
            'US': '🇺🇸',
            'EU': '🇪🇺',
            'UK': '🇬🇧',
            'JP': '🇯🇵',
            'CN': '🇨🇳',
            'CA': '🇨🇦',
            'AU': '🇦🇺',
            'CH': '🇨🇭'
        };
        return flags[country] || '🌐';
    }
}
