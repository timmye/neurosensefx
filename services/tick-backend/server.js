const path = require('path');
const config = require('./config');
const { createLogger } = require('./utils/Logger');
const log = createLogger('Server');

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

log.info(`Backend Environment: ${config.nodeEnv}`);
log.info(`Backend WebSocket Port: ${port}`);
log.info(`WebSocket URL: ws://localhost:${port}`);
log.info(`TradingView Session: ${config.tradingViewSession ? 'authenticated' : 'unauthenticated (limited)'}`);

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
    log.error('[DB] Schema verification failed on startup:', err.message);
    process.exit(1);
});

// Global error handlers — uncaught exceptions are fatal; exit so the process manager can restart cleanly.
process.on('uncaughtException', (error) => {
    log.error('[FATAL] Uncaught exception:', error.message);
    log.error(error.stack);
    // Allow logs to flush before exiting; the process manager (pm2/Docker/run.sh) will restart.
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('[FATAL] Unhandled promise rejection:', reason);
    log.error('at:', promise);
});

const { sessionManager } = require('./middleware');

// Handle graceful shutdown — drain DB pool and Redis before exit
async function gracefulShutdown(signal) {
    log.info(`${signal} received, shutting down backend...`);
    session.disconnect();
    tradingViewSession.disconnect();
    wsServer.close(); // Stop heartbeat

    // Drain PostgreSQL pool
    try {
        await pool.end();
        log.info('[DB] PostgreSQL pool closed.');
    } catch (err) {
        log.error('[DB] Error closing pool:', err.message);
    }

    // Close Redis connection
    try {
        sessionManager.redis.quit();
        log.info('[SessionManager] Redis connection closed.');
    } catch (err) {
        log.error('[SessionManager] Error closing Redis:', err.message);
    }

    wsServer.wss.close(() => {
        log.info('WebSocket server closed.');
        process.exit(0);
    });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Initiate the cTrader session connection when the backend starts
session.connect()
    .catch((error) => {
        log.error('[ERROR] Failed to connect to cTrader:', error);
        // Continue running - graceful degradation
    });

// Initiate the TradingView session connection
tradingViewSession.connect(config.tradingViewSession)
    .catch((error) => {
        log.error('[ERROR] Failed to connect to TradingView:', error);
        // Continue running - graceful degradation
    });
