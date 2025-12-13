
import { Router } from 'express';
import { SchwabService } from '../services/schwabService.js';

export function createSchwabAuthRouter(schwabService: SchwabService): Router {
    const router = Router();

    // Generate Auth URL
    router.get('/login', (req, res) => {
        try {
            const url = schwabService.getAuthUrl();
            res.json({ url });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create auth url' });
        }
    });

    // Manually set token
    router.post('/token', async (req, res) => {
        try {
            const { access_token, refresh_token } = req.body || {};
            if (!access_token) {
                res.status(400).json({ error: 'Missing access_token' });
                return;
            }
            await schwabService.setTokens(String(access_token), refresh_token ? String(refresh_token) : undefined);
            res.json({ connected: schwabService.isConnected() });
        } catch {
            res.status(500).json({ error: 'Failed to set tokens' });
        }
    });

    // Exchange auth code
    router.post('/exchange', async (req, res) => {
        try {
            const { code, redirect_url } = req.body || {};
            let authCode = code ? String(code) : '';

            // Try to extract code from URL if passed as redirect_url
            if (!authCode && redirect_url) {
                try {
                    const u = new URL(String(redirect_url));
                    authCode = u.searchParams.get('code') || '';
                } catch { }
            }

            if (!authCode) {
                res.status(400).json({ error: 'Missing code or redirect_url' });
                return;
            }

            await schwabService.exchangeCode(authCode);
            res.json({ connected: schwabService.isConnected() });
        } catch (e) {
            res.status(500).json({ error: 'Auth code exchange failed' });
        }
    });

    // Callback handler (standard)
    router.get('/callback', async (req, res) => {
        try {
            const code = String(req.query.code || '');
            if (!code) {
                res.status(400).json({ error: 'Missing code' });
                return;
            }
            await schwabService.exchangeCode(code);
            res.json({ connected: schwabService.isConnected() });
        } catch (error) {
            res.status(500).json({ error: 'Auth callback failed' });
        }
    });

    return router;
}
