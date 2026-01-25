
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

export class EconomicCalendarService {
    private static readonly STATIC_EVENTS = [
        // FOMC Meetings 2026
        { date: '2026-01-28', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-03-17', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-05-06', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-06-16', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-07-28', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-09-15', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-11-04', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
        { date: '2026-12-15', time: '14:00', event: 'FOMC Meeting Decision', country: 'US', impact: 'HIGH' as const },
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
