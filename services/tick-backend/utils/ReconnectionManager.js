/**
 * ReconnectionManager handles exponential backoff reconnection logic.
 * Used by both CTraderSession and TradingViewSession for identical reconnection behavior.
 */
class ReconnectionManager {
    constructor(maxDelay = 60000, initialDelay = 1000) {
        this.maxDelay = maxDelay;
        this.initialDelay = initialDelay;
        this.reconnectAttempts = 0;
        this.reconnectDelay = initialDelay;
        this.reconnectTimeout = null;
    }

    /**
     * Schedules a reconnection attempt with exponential backoff.
     * @param {Function} reconnectFn - Async function to call for reconnection
     */
    scheduleReconnect(reconnectFn) {
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxDelay
        );
        console.log(`[ReconnectionManager] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectAttempts++;
            try {
                await reconnectFn();
            } catch (error) {
                console.error('[ReconnectionManager] Reconnect attempt failed:', error);
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
     */
    reset() {
        this.reconnectAttempts = 0;
        this.reconnectDelay = this.initialDelay;
    }
}

module.exports = { ReconnectionManager };
