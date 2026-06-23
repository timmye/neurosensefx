'use strict';

/**
 * Tiny dependency-free logging layer.
 *
 * Each module creates a logger with a stable `[ModuleName]` prefix and emits at
 * one of four levels (error > warn > info > debug). Verbosity is controlled once
 * at startup via `config.logLevel` (env `LOG_LEVEL`): a call is emitted only when
 * its severity is at or below the configured threshold. error is always emitted.
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
function createLogger(moduleName) {
    const prefix = COLORIZE
        ? (level) => `${C[level]}[${moduleName}]${C.reset}`
        : () => `[${moduleName}]`;

    const mk = (level, sink) => (...args) => {
        if (LEVELS[level] <= THRESHOLD) {
            sink(prefix(level), ...args);
        }
    };

    return {
        error: mk('error', console.error),
        warn: mk('warn', console.warn),
        info: mk('info', console.log),
        debug: mk('debug', console.log)
    };
}

module.exports = { createLogger, LEVELS };
