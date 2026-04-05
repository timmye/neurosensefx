console.log('[DEBUG] 1. Executing backend server.js');

// Load environment variables from root directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { CTraderSession } = require('./CTraderSession');
const { TradingViewSession } = require('./TradingViewSession');
const { WebSocketServer } = require('./WebSocketServer');
const { listen: listenHttp, server: httpServer } = require('./httpServer');
const { verifySchema } = require('./db');

// Create services first (needed by WebSocketServer and TradingViewSession)
const { TwapService } = require('./TwapService');
const { MarketProfileService } = require('./MarketProfileService');
const twapService = new TwapService();
const marketProfileService = new MarketProfileService();

// Environment-aware port configuration
const port = process.env.WS_PORT || (process.env.NODE_ENV === 'production' ? 8081 : 8080);

// TradingView configuration
// Leave undefined to use unauthenticated mode (limited data)
const tradingViewSessionId = process.env.TRADINGVIEW_SESSION_ID || undefined;

// Log environment configuration
console.log(`🌍 Backend Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🚀 Backend WebSocket Port: ${port}`);
console.log(`📡 WebSocket URL: ws://localhost:${port}`);
console.log(`📊 TradingView Session: ${tradingViewSessionId ? 'authenticated' : 'unauthenticated (limited)'}`);

const session = new CTraderSession();
const tradingViewSession = new TradingViewSession(twapService, marketProfileService);
// WebSocketServer receives the shared http.Server instead of a port (ref: DL-002).
// Express and ws share the same HTTP server; cookies are sent on WS upgrade.
const wsServer = new WebSocketServer(httpServer, session, tradingViewSession, twapService, marketProfileService);

// Start Express HTTP server and verify PostgreSQL auth schema on startup (ref: DL-002, DL-004)
listenHttp(port);
verifySchema().catch(err => console.error('[DB] Schema verification failed on startup:', err.message));

// Global error handlers to prevent crashes on connection interrupt
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught exception:', error.message);
    console.error(error.stack);
    // Attempt graceful recovery but don't crash immediately
    // Log the error and continue running if possible
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled promise rejection:', reason);
    console.error('at:', promise);
    // Log but don't crash - connection failures should be handled gracefully
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down backend...');
    session.disconnect();
    tradingViewSession.disconnect();
    wsServer.close(); // Stop heartbeat
    wsServer.wss.close(() => {
        console.log('WebSocket server closed.');
        process.exit(0);
    });
});

// Initiate the cTrader session connection when the backend starts
session.connect()
    .then(() => {
        console.log('[DEBUG] cTrader session connected successfully.');
    })
    .catch((error) => {
        console.error('[ERROR] Failed to connect to cTrader:', error);
        console.log('[INFO] Starting backend in degraded mode without cTrader connection...');
        // Continue running - graceful degradation
    });

// Initiate the TradingView session connection
tradingViewSession.connect(tradingViewSessionId)
    .then(() => {
        console.log('[DEBUG] TradingView session connected successfully.');
    })
    .catch((error) => {
        console.error('[ERROR] Failed to connect to TradingView:', error);
        console.log('[INFO] Starting backend in degraded mode without TradingView connection...');
        // Continue running - graceful degradation
    });
