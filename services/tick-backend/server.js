const path = require('path');
const config = require('./config');

const { CTraderSession } = require('./CTraderSession');
const { TradingViewSession } = require('./TradingViewSession');
const { WebSocketServer } = require('./WebSocketServer');
const { listen: listenHttp, server: httpServer, addCandleApiRoutes } = require('./httpServer');
const { verifySchema, pool } = require('./db');

// Create services first (needed by WebSocketServer and TradingViewSession)
const { TwapService } = require('./TwapService');
const { MarketProfileService } = require('./MarketProfileService');
const twapService = new TwapService();
const marketProfileService = new MarketProfileService();

// Environment-aware port configuration
const port = config.port || (config.nodeEnv === 'production' ? 8081 : 8080);

console.log(`Backend Environment: ${config.nodeEnv}`);
console.log(`Backend WebSocket Port: ${port}`);
console.log(`WebSocket URL: ws://localhost:${port}`);
console.log(`TradingView Session: ${config.tradingViewSession ? 'authenticated' : 'unauthenticated (limited)'}`);

const session = new CTraderSession();
const tradingViewSession = new TradingViewSession(twapService, marketProfileService);

// Register HTTP API routes that depend on the cTrader session
addCandleApiRoutes(session);
// WebSocketServer receives the shared http.Server instead of a port (ref: DL-002).
// Express and ws share the same HTTP server; cookies are sent on WS upgrade.
const wsServer = new WebSocketServer(httpServer, session, tradingViewSession, twapService, marketProfileService);

// Start Express HTTP server and verify PostgreSQL auth schema on startup (ref: DL-002, DL-004)
listenHttp(port);
verifySchema().catch(err => {
    console.error('[DB] Schema verification failed on startup:', err.message);
    process.exit(1);
});

// Global error handlers — uncaught exceptions are fatal; exit so the process manager can restart cleanly.
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught exception:', error.message);
    console.error(error.stack);
    // Allow logs to flush before exiting; the process manager (pm2/Docker/run.sh) will restart.
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled promise rejection:', reason);
    console.error('at:', promise);
});

const { sessionManager } = require('./middleware');

// Handle graceful shutdown — drain DB pool and Redis before exit
async function gracefulShutdown(signal) {
    console.log(`${signal} received, shutting down backend...`);
    session.disconnect();
    tradingViewSession.disconnect();
    wsServer.close(); // Stop heartbeat

    // Drain PostgreSQL pool
    try {
        await pool.end();
        console.log('[DB] PostgreSQL pool closed.');
    } catch (err) {
        console.error('[DB] Error closing pool:', err.message);
    }

    // Close Redis connection
    try {
        sessionManager.redis.quit();
        console.log('[SessionManager] Redis connection closed.');
    } catch (err) {
        console.error('[SessionManager] Error closing Redis:', err.message);
    }

    wsServer.wss.close(() => {
        console.log('WebSocket server closed.');
        process.exit(0);
    });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Initiate the cTrader session connection when the backend starts
session.connect()
    .catch((error) => {
        console.error('[ERROR] Failed to connect to cTrader:', error);
        // Continue running - graceful degradation
    });

// Initiate the TradingView session connection
tradingViewSession.connect(config.tradingViewSession)
    .catch((error) => {
        console.error('[ERROR] Failed to connect to TradingView:', error);
        // Continue running - graceful degradation
    });
