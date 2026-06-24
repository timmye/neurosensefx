'use strict';

/**
 * Tiny dependency-free logging layer.
 *
 * Each module creates a logger with a stable `[ModuleName]` prefix and emits at
 * one of four levels (error > warn > info > debug). Verbosity is controlled once
 * at startup via `config.logLevel` (env `LOG_LEVEL`): a call is emitted only when
 * its severity is at or below the configured threshold. error is always emitted.
 *
 * Every emitted line is prefixed with an ISO-8601 millisecond timestamp
 * (e.g. `2026-06-24T15:03:21.417Z [Module] ...`) so `backend.log` is
 * self-sufficient for root-causing reconnect loops (Loop-H). This is critical:
 * the runtime cTrader reconnect loop was diagnosed against a log that carried NO
 * per-line wall-clock time, making per-cycle timing impossible to reconstruct.
 *
 * Output delegates to `console` (error→console.error, warn→console.warn,
 * info/debug→console.log) so existing log capture (run.sh `tail -f`/grep) and
 * stdout/stderr behavior are preserved. ANSI color is applied only outside
 * production.
 */
const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const THRESHOLD = LEVELS[config.logLevel] ?? LEVELS.info;
const COLORIZE = config.nodeEnv !== 'production';

const C = {
    error: '\x1b[31m', // red
    warn: '\x1b[33m',  // yellow
    info: '\x1b[36m',  // cyan
    debug: '\x1b[90m', // bright black / gray
    reset: '\x1b[0m'
};

/**
 * Create a prefixed logger for a module.
 * @param {string} moduleName - Short module name used in the `[ModuleName]` prefix.
 * @returns {{debug: Function, info: Function, warn: Function, error: Function}}
 */
/**
 * ISO-8601 UTC timestamp with millisecond precision, e.g. `2026-06-24T15:03:21.417Z`.
 * Prepended to every log line so backend.log reconstructs per-cycle timing.
 */
function timestamp() {
    return new Date().toISOString();
}

function createLogger(moduleName) {
    const prefix = COLORIZE
        ? (level) => `${C[level]}[${moduleName}]${C.reset}`
        : () => `[${moduleName}]`;

    const mk = (level, sink) => (...args) => {
        if (LEVELS[level] <= THRESHOLD) {
            sink(`${timestamp()} ${prefix(level)}`, ...args);
        }
    };

    return {
        error: mk('error', console.error),
        warn: mk('warn', console.warn),
        info: mk('info', console.log),
        debug: mk('debug', console.log)
    };
}

/**
 * Render a cTrader rejection (or any thrown value) into a single loggable string
 * that never collapses to "[object Object]" and never drops the errorCode.
 *
 * The cTrader-Layer library rejects `sendCommand` with the RAW protobuf payload
 * (a plain object) when `payload.errorCode` is set (see its `_onDecodedData`:
 * `sentCommand.reject(payload)`). On a plain payload `err.message` is undefined,
 * so naive `err.message || String(err)` logging prints "[object Object]" and the
 * `errorCode`/`description` that actually explain the rejection are lost — this
 * was Loop-D. This helper surfaces those fields first.
 *
 * @param {*} err - The rejected value (raw payload, Error, or other).
 * @returns {string} A human-readable, single-line description.
 */
function describeError(err) {
    if (err == null) return String(err);
    const parts = [];
    if (err.errorCode) parts.push(`errorCode=${err.errorCode}`);
    if (err.description) parts.push(`description=${err.description}`);
    if (err.message) parts.push(err.message);
    if (err.code) parts.push(`code=${err.code}`);
    if (err.symbol) parts.push(`symbol=${err.symbol}`);
    if (parts.length > 0) return parts.join(' ');
    // A raw object carrying none of the known fields — avoid "[object Object]".
    try { return JSON.stringify(err); } catch (e) { return String(err); }
}

module.exports = { createLogger, describeError, LEVELS };
