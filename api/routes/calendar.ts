import { Router } from 'express';
import { EconomicCalendarService } from '../services/economicCalendarService.js';
import { SchwabService } from '../services/schwabService.js';

const router = Router();
const calendarService = new EconomicCalendarService();

/**
 * GET /api/calendar/today
 * Get economic events for today
 */
router.get('/today', async (req, res) => {
    try {
        const events = await calendarService.getEventsToday();
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching today events:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
    }
});

/**
 * GET /api/calendar/week
 * Get economic events for this week
 */
router.get('/week', async (req, res) => {
    try {
        const events = await calendarService.getEventsThisWeek();
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching week events:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
    }
});

/**
 * GET /api/calendar/next-week
 * Get economic events for next week
 */
router.get('/next-week', async (req, res) => {
    try {
        const events = await calendarService.getEventsNextWeek();
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching next week events:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
    }
});

/**
 * GET /api/calendar/next-high-impact
 * Get the next upcoming high-impact event
 */
router.get('/next-high-impact', async (req, res) => {
    try {
        const event = await calendarService.getNextHighImpactEvent();
        res.json({ success: true, event });
    } catch (error) {
        console.error('Error fetching next high impact event:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch event' });
    }
});

/**
 * GET /api/calendar/news
 * Get market news headlines
 */
router.get('/news', async (req, res) => {
    try {
        const { symbol, limit } = req.query;
        const schwabService = req.app.get('schwabService') as SchwabService;

        const news = await schwabService.getMarketNews(
            symbol as string | undefined,
            limit ? parseInt(limit as string) : 20
        );

        res.json({ success: true, news });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch news' });
    }
});

export default router;
