/**
 * ReconnectionManager handles exponential backoff reconnection logic.
 * Used by both CTraderSession and TradingViewSession for identical reconnection behavior.
 *
 * Once `maxAttempts` consecutive failures have elapsed the manager stops
 * escalating the delay (it plateaus at `maxDelay`) but it NEVER permanently
 * gives up — a genuinely-recoverable feed (transient network blip, broker
 * restart) always gets another retry. A periodic escalation log surfaces a
 * genuinely-broken feed (e.g. wrong credentials) so it is detectable, not silent.
 */
const { createLogger } = require('./Logger');
const log = createLogger('ReconnectionManager');

class ReconnectionManager {
    constructor(maxDelay = 15000, initialDelay = 500, maxAttempts = 20) {
        this.maxDelay = maxDelay;
        this.initialDelay = initialDelay;
        this.maxAttempts = maxAttempts;
        this.reconnectAttempts = 0;
        this.reconnectDelay = initialDelay;
        this.reconnectTimeout = null;
    }

    /**
     * Schedules a reconnection attempt with exponential backoff.
     * Never permanently gives up: once the counter passes `maxAttempts` it keeps
     * retrying at the `maxDelay` plateau. Two near-simultaneous calls collapse
     * onto a single pending timer (timer hygiene).
     * @param {Function} reconnectFn - Async function to call for reconnection
     */
    scheduleReconnect(reconnectFn) {
        // Timer hygiene: clear any previously pending timer before arming a new
        // one so two rapid calls cannot spawn two concurrent reconnect chains.
        this.cancelReconnect();

        const atPlateau = this.reconnectAttempts >= this.maxAttempts;
        const baseDelay = atPlateau
            ? this.maxDelay
            : Math.min(
                  this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
                  this.maxDelay
              );
        const jitter = Math.random() * 0.3 * baseDelay;
        const delay = baseDelay + jitter;

        if (atPlateau) {
            log.warn(`Still reconnecting — attempt ${this.reconnectAttempts} after extended failures (capped at maxDelay ${this.maxDelay}ms)`);
        } else {
            log.debug(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
        }

        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectAttempts++;
            try {
                await reconnectFn();
                this.reset();
            } catch (error) {
                log.error('Reconnect attempt failed:', error);
                this.scheduleReconnect(reconnectFn);
            }
        }, delay);
    }

    /**
     * Cancels any pending reconnection attempt.
     */
    cancelReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    /**
     * Resets reconnection state after successful connection.
     * Also cancels any pending timer so a reset manager has no armed retry.
     * Callable publicly (e.g. from a session's `reconnect()` before `connect()`).
     */
    reset() {
        this.reconnectAttempts = 0;
        this.reconnectDelay = this.initialDelay;
        this.cancelReconnect();
    }
}

module.exports = { ReconnectionManager };
