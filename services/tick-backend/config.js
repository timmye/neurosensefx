/**
 * Centralized configuration for the tick-backend service.
 * Reads all environment variables once at startup and exports a typed config object.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Required env var - throws if missing.
 */
function required(name) {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(`[config] Required environment variable ${name} is missing or empty`);
    }
    return value;
}

/**
 * Optional env var with a fallback default.
 */
function optional(name, defaultValue) {
    return process.env[name] !== undefined ? process.env[name] : defaultValue;
}

const config = {
    // ── Server ──────────────────────────────────────────────────────────
    // WebSocket server port (8081 production, 8080 development)
    port: optional('WS_PORT', undefined),
    nodeEnv: optional('NODE_ENV', 'development'),

    // ── cTrader ─────────────────────────────────────────────────────────
    // cTrader OpenAPI credentials and connection settings
    ctraderClientId: required('CTRADER_CLIENT_ID'),
    ctraderClientSecret: required('CTRADER_CLIENT_SECRET'),
    ctraderAccessToken: required('CTRADER_ACCESS_TOKEN'),
    ctraderRefreshToken: required('CTRADER_REFRESH_TOKEN'),
    ctraderAccountId: required('CTRADER_ACCOUNT_ID'),
    ctraderHost: required('HOST'),
    ctraderPort: optional('PORT', '5035'),

    // ── TradingView ────────────────────────────────────────────────────
    // TradingView session ID for authenticated data access.
    // Leave undefined to use unauthenticated mode (limited data).
    tradingViewSession: optional('TRADINGVIEW_SESSION_ID', undefined),

    // Connect-phase deadline for the tradingview-ws `connect()` call. If the
    // underlying connect hangs (DNS/network), reject so the existing catch
    // routes through handleDisconnect → scheduleReconnect. Mirrors the cTrader
    // supervisor connect-phase deadline; TV has no supervisor, so the deadline
    // lives here.
    tvConnectTimeoutMs: Number(optional('TV_CONNECT_TIMEOUT_MS', '15000')),

    // Maximum reconnection attempts for session recovery
    maxReconnectAttempts: Number(optional('MAX_RECONNECT_ATTEMPTS', '20')),

    // ── Restore runner tuning (Phase 4.1 / Loop-E) ──────────────────────
    // Post-connect subscription restore runs bounded-concurrency with
    // inter-request spacing + a per-command budget. ~56 commands (28 symbols ×
    // 2) complete well under dataStaleMs (60s) while keeping cTrader from
    // throttling us. Configurable without a code change.
    restoreConcurrency: Number(optional('CTRADER_RESTORE_CONCURRENCY', '6')),
    restoreSpacingMs: Number(optional('CTRADER_RESTORE_SPACING_MS', '50')),
    // FIX M1: strictly LESS than the CTraderTransportAdapter's 15s per-RPC TTL,
    // so the restore budget rejects a stalled command BEFORE the adapter's TTL
    // force-closes the whole transport. This lets restore make progress (isolate
    // one bad command) and removes the ambiguous equal-timer race.
    restoreCommandTimeoutMs: Number(optional('CTRADER_RESTORE_COMMAND_TIMEOUT_MS', '12000')),
    restoreMaxRetries: Number(optional('CTRADER_RESTORE_MAX_RETRIES', '2')),

    // ── Database (PostgreSQL) ──────────────────────────────────────────
    pgHost: optional('PG_HOST', 'localhost'),
    pgPort: parseInt(optional('PG_PORT', '5432'), 10),
    pgDatabase: optional('PG_DATABASE', 'neurosensefx'),
    pgUser: optional('PG_USER', 'neurosensefx'),
    pgPassword: optional('PG_PASSWORD', ''),

    // ── Redis ───────────────────────────────────────────────────────────
    redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),
};

// ── Logging ───────────────────────────────────────────────────────────
// Verbosity: error | warn | info | debug. Defaults to info in production, debug otherwise.
const _knownLevels = ['error', 'warn', 'info', 'debug'];
const _logLevelRaw = (optional('LOG_LEVEL', config.nodeEnv === 'production' ? 'info' : 'debug') || 'info').toLowerCase();
config.logLevel = _knownLevels.includes(_logLevelRaw) ? _logLevelRaw : 'info';

module.exports = config;
