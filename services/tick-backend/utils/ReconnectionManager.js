/**
 * ReconnectionManager handles exponential backoff reconnection logic.
 * Used by both CTraderSession and TradingViewSession for identical reconnection behavior.
 */
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
     * @param {Function} reconnectFn - Async function to call for reconnection
     */
    scheduleReconnect(reconnectFn) {
        if (this.reconnectAttempts >= this.maxAttempts) {
            console.error('[ReconnectionManager] Max reconnection attempts reached. Giving up.');
            return;
        }

        const baseDelay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxDelay
        );
        const jitter = Math.random() * 0.3 * baseDelay;
        const delay = baseDelay + jitter;
        console.log(`[ReconnectionManager] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectAttempts++;
            try {
                await reconnectFn();
                this.reset();
            } catch (error) {
                console.error('[ReconnectionManager] Reconnect attempt failed:', error);
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
     */
    reset() {
        this.reconnectAttempts = 0;
        this.reconnectDelay = this.initialDelay;
    }
}

module.exports = { ReconnectionManager };
