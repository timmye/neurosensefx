/**
 * Express HTTP server integrated into the existing Node.js backend.
 * Shares the same port as the WebSocket server via http.createServer.
 * Dev mode enables CORS for Vite dev server on localhost:5174. (ref: DL-002, DL-018)
 */
const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { errorResponse } = require('./middleware');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

if (config.nodeEnv !== 'production') {
    // Dev-only CORS: Vite runs on port 5174, backend on 8081 (ref: DL-018)
    const cors = require('cors');
    app.use(cors({
        origin: 'http://localhost:5174',
        credentials: true
    }));
}

// Security headers applied to all responses (ref: DL-017)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

const { authRoutes } = require('./authRoutes');
app.use(authRoutes);

// persistenceRoutes and candle routes are mounted by addCandleApiRoutes
// (called from server.js) to ensure correct route ordering:
// auth -> candles -> persistence. This prevents /api/candles from being
// shadowed by /api/markers/:symbol (Express matches routes in registration order).
const { persistenceRoutes } = require('./persistenceRoutes');

/**
 * Register candle API and persistence routes.
 * Must mount candles BEFORE persistence to avoid route shadowing.
 * Called from server.js after the cTrader session is instantiated.
 */
function addCandleApiRoutes(cTraderSession) {
    const RESOLUTION_TO_PERIOD = {
        '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
        '1h': 'H1', '4h': 'H4', '12h': 'H12', 'D': 'D1', 'W': 'W1', 'M': 'MN1'
    };

    const candleRouter = express.Router();

    candleRouter.get('/api/candles', async (req, res) => {
        const { symbol, resolution, from, to } = req.query;

        if (!symbol || !resolution || !from || !to) {
            return res.status(400).json({ error: 'Missing required params: symbol, resolution, from, to' });
        }

        const period = RESOLUTION_TO_PERIOD[resolution];
        if (!period) {
            return res.status(400).json({ error: `Unsupported resolution: ${resolution}` });
        }

        try {
            const bars = await cTraderSession.fetchHistoricalCandles(
                symbol, period, Number(from), Number(to)
            );
            res.json({ symbol, resolution, period, bars, count: bars.length });
        } catch (error) {
            console.error(`[API] Failed to fetch candles for ${symbol} ${resolution}:`, error.message);
            res.status(500).json({ error: error.message, bars: [] });
        }
    });

    // Route order: auth -> candles -> persistence
    // This prevents /api/candles from matching /api/markers/:symbol
    app.use(candleRouter);
    app.use(persistenceRoutes);
}

const server = http.createServer(app);

/**
 * Start the HTTP server on the given port. Returns a Promise that resolves
 * with the http.Server instance once listening.
 * @param {number} port
 * @returns {Promise<http.Server>}
 */
function listen(port) {
    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            console.log(`[HTTP] Express server listening on port ${port}`);
            resolve(server);
        });
        server.on('error', reject);
    });
}

module.exports = { app, server, listen, addCandleApiRoutes };
